;; AnchorFi Lending Pool
;; Core borrow/repay logic with interest accrual
;; Optimized for gas efficiency

(define-constant ERR-NOT-AUTHORIZED (err u400)) ;; Error for unauthorized access
(define-constant ERR-ZERO-AMOUNT (err u401)) ;; Error for zero amount inputs
(define-constant ERR-INSUFFICIENT-COLLATERAL (err u402))
(define-constant ERR-NO-ACTIVE-LOAN (err u403))
(define-constant ERR-OVERPAYMENT (err u404))
(define-constant ERR-ORACLE-ERROR (err u405))
(define-constant ERR-HEALTHY-POSITION (err u406))

;; LTV = 70%, Liquidation threshold = 80%, Liquidation bonus = 10%
(define-constant LTV_RATIO u700)           ;; 70.0%
(define-constant LIQUIDATION_THRESHOLD u800) ;; 80.0%
(define-constant LIQUIDATION_BONUS u100)    ;; 10.0%
(define-constant RATIO_PRECISION u1000)
(define-constant INTEREST_RATE_PER_BLOCK u10) ;; 0.001% per block (~5% APR at 10min blocks)
(define-constant INTEREST_PRECISION u1000000)

(define-data-var contract-owner principal tx-sender)
(define-data-var oracle-contract principal tx-sender)
(define-data-var vault-contract principal tx-sender)
(define-data-var ausd-contract principal tx-sender)
(define-data-var total-borrowed uint u0)
(define-data-var last-price uint u0)
(define-data-var last-price-block uint u0)

(define-map loans
  principal
  {
    principal-amount: uint,
    interest-accrued: uint,
    collateral-locked: uint,
    opened-at-block: uint,
    last-accrual-block: uint
  }
)

(define-public (configure (oracle principal) (vault principal) (ausd principal))
  ;; Configure contract dependencies
  ;; Only callable by contract owner
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set oracle-contract oracle)
    (var-set vault-contract vault)
    (var-set ausd-contract ausd)
    (ok true)
  )
)

(define-private (get-stx-price)
  (let (
    (current-block stacks-block-height)
    (cached-block (var-get last-price-block))
  )
    (if (and (> cached-block u0) (<= (- current-block cached-block) u10))
      (ok (var-get last-price))
      (let ((new-price (contract-call? .oracle get-price)))
        (var-set last-price (unwrap! new-price (err u0)))
        (var-set last-price-block current-block)
        new-price
      )
    )
  )
)

(define-private (calculate-health-factor (collateral-value-usd uint) (total-owed uint))
  (if (is-eq total-owed u0)
    u0
    (/ (* collateral-value-usd RATIO_PRECISION) total-owed)
  )
)

(define-private (calculate-interest (principal-amount uint) (blocks-elapsed uint))
  ;; Calculate accrued interest: principal * rate * time / precision
  ;; Rate is per block, precision is 1e6 for 6 decimal places
  (/ (* principal-amount (* INTEREST_RATE_PER_BLOCK blocks-elapsed)) INTEREST_PRECISION)
)

(define-private (accrue-interest (borrower principal))
  (match (map-get? loans borrower)
    loan
    (let (
      (blocks-elapsed (- stacks-block-height (get last-accrual-block loan)))
      (new-interest (calculate-interest (get principal-amount loan) blocks-elapsed))
    )
      (map-set loans borrower (merge loan {
        interest-accrued: (+ (get interest-accrued loan) new-interest),
        last-accrual-block: stacks-block-height
      }))
      true
    )
    false
  )
)

(define-public (borrow (amount uint) (collateral-amount uint))
  ;; Borrow aUSD against STX collateral
  ;; Locks collateral and mints aUSD
  (let (
    (price (unwrap! (get-stx-price) ERR-ORACLE-ERROR))
    (collateral-value-usd (stx-to-usd collateral-amount price))
    (max-borrow (calculate-max-borrow collateral-value-usd))
  )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (> collateral-amount u0) ERR-ZERO-AMOUNT)
    (asserts! (<= amount max-borrow) ERR-INSUFFICIENT-COLLATERAL)
    (asserts! (is-none (map-get? loans tx-sender)) ERR-NOT-AUTHORIZED)

    (try! (contract-call? .collateral-vault lock-collateral tx-sender collateral-amount))
    (try! (contract-call? .ausd-token mint amount tx-sender))

    (map-set loans tx-sender {
      principal-amount: amount,
      interest-accrued: u0,
      collateral-locked: collateral-amount,
      opened-at-block: stacks-block-height,
      last-accrual-block: stacks-block-height
    })
    (var-set total-borrowed (+ (var-get total-borrowed) amount))
    (ok amount)
  )
)

(define-public (repay (amount uint))
  ;; Repay loan by burning aUSD
  ;; Unlocks collateral if fully repaid
  (let (
    (loan (unwrap! (map-get? loans tx-sender) ERR-NO-ACTIVE-LOAN))
    (accrued (accrue-interest tx-sender))
    (updated-loan (unwrap! (map-get? loans tx-sender) ERR-NO-ACTIVE-LOAN))
    (total-owed (+ (get principal-amount updated-loan) (get interest-accrued updated-loan)))
  )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (<= amount total-owed) ERR-OVERPAYMENT)

    (try! (contract-call? .ausd-token burn amount tx-sender))

    (if (is-eq amount total-owed)
      (begin
        (try! (contract-call? .collateral-vault unlock-collateral tx-sender (get collateral-locked updated-loan)))
        (map-delete loans tx-sender)
        (var-set total-borrowed (- (var-get total-borrowed) (get principal-amount updated-loan)))
      )
      (let (
        (interest-paid (if (<= amount (get interest-accrued updated-loan)) amount (get interest-accrued updated-loan)))
        (principal-paid (if (> amount (get interest-accrued updated-loan))
                           (- amount (get interest-accrued updated-loan))
                           u0))
      )
        (map-set loans tx-sender (merge updated-loan {
          principal-amount: (- (get principal-amount updated-loan) principal-paid),
          interest-accrued: (- (get interest-accrued updated-loan) interest-paid)
        }))
        (var-set total-borrowed (- (var-get total-borrowed) principal-paid))
      )
    )
    (ok amount)
  )
)

(define-public (liquidate (borrower principal))
  ;; Liquidate an undercollateralized loan
  ;; Seizes collateral and burns debt
  (let (
    (accrued (accrue-interest borrower))
    (loan (unwrap! (map-get? loans borrower) ERR-NO-ACTIVE-LOAN))
    (price (unwrap! (get-stx-price) ERR-ORACLE-ERROR))
    (collateral-value-usd (stx-to-usd (get collateral-locked loan) price))
    (total-owed (+ (get principal-amount loan) (get interest-accrued loan)))
    (health-factor (calculate-health-factor collateral-value-usd total-owed))
    (collateral-to-seize (+ (get collateral-locked loan)
                            (/ (* (get collateral-locked loan) LIQUIDATION_BONUS) RATIO_PRECISION)))
  )
    (asserts! (< health-factor LIQUIDATION_THRESHOLD) ERR-HEALTHY-POSITION)
    (try! (contract-call? .ausd-token burn total-owed tx-sender))
    (try! (contract-call? .collateral-vault seize-collateral borrower
            (if (<= collateral-to-seize (get collateral-locked loan)) collateral-to-seize (get collateral-locked loan)) tx-sender))
    (map-delete loans borrower)
    (var-set total-borrowed (- (var-get total-borrowed) (get principal-amount loan)))
    (ok true)
  )
)

(define-read-only (get-loan (borrower principal))
  ;; Get loan details for a borrower
  (ok (map-get? loans borrower))
)

(define-read-only (get-health-factor (borrower principal))
  (match (map-get? loans borrower)
    loan
    (match (get-stx-price)
      price
      (let (
        (collateral-value-usd (stx-to-usd (get collateral-locked loan) price))
        (total-owed (+ (get principal-amount loan) (get interest-accrued loan)))
      )
        (ok (calculate-health-factor collateral-value-usd total-owed))
      )
      e (err e)
    )
    (ok u0)
  )
)

(define-read-only (get-total-borrowed)
  (ok (var-get total-borrowed))
)

(define-read-only (get-max-borrow (collateral-amount uint))
  (match (get-stx-price)
    price
    (let ((collateral-value-usd (stx-to-usd collateral-amount price)))
      (ok (calculate-max-borrow collateral-value-usd))
    )
    e (err e)
  )
)
