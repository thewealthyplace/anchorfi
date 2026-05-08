;; AnchorFi Collateral Vault
;; Manages STX deposits used as collateral for borrowing

(define-constant ERR-NOT-AUTHORIZED (err u300))
(define-constant ERR-ZERO-AMOUNT (err u301))
(define-constant ERR-INSUFFICIENT-BALANCE (err u302))
(define-constant ERR-LOCKED-COLLATERAL (err u303))
(define-constant ERR-VAULT-NOT-FOUND (err u304))

(define-data-var contract-owner principal tx-sender)
(define-data-var lending-pool-contract principal tx-sender)
(define-data-var total-collateral uint u0)

(define-map vaults
  principal
  {
    deposited: uint,
    locked: uint
  }
)

(define-public (set-lending-pool (pool-contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set lending-pool-contract pool-contract)
    (ok pool-contract)
  )
)

(define-public (deposit (amount uint))
  (let (
    (current-vault (default-to { deposited: u0, locked: u0 } (map-get? vaults tx-sender)))
  )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set vaults tx-sender {
      deposited: (+ (get deposited current-vault) amount),
      locked: (get locked current-vault)
    })
    (var-set total-collateral (+ (var-get total-collateral) amount))
    (ok amount)
  )
)

(define-public (withdraw (amount uint))
  (let (
    (caller tx-sender)
    (vault (unwrap! (map-get? vaults caller) ERR-VAULT-NOT-FOUND))
    (available (- (get deposited vault) (get locked vault)))
  )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (>= available amount) ERR-LOCKED-COLLATERAL)
    (try! (as-contract (stx-transfer? amount tx-sender caller)))
    (map-set vaults caller {
      deposited: (- (get deposited vault) amount),
      locked: (get locked vault)
    })
    (var-set total-collateral (- (var-get total-collateral) amount))
    (ok amount)
  )
)

(define-public (lock-collateral (borrower principal) (amount uint))
  (let (
    (vault (unwrap! (map-get? vaults borrower) ERR-VAULT-NOT-FOUND))
    (available (- (get deposited vault) (get locked vault)))
  )
    (asserts! (is-eq contract-caller (var-get lending-pool-contract)) ERR-NOT-AUTHORIZED)
    (asserts! (>= available amount) ERR-INSUFFICIENT-BALANCE)
    (map-set vaults borrower {
      deposited: (get deposited vault),
      locked: (+ (get locked vault) amount)
    })
    (ok amount)
  )
)

(define-public (unlock-collateral (borrower principal) (amount uint))
  (let (
    (vault (unwrap! (map-get? vaults borrower) ERR-VAULT-NOT-FOUND))
  )
    (asserts! (is-eq contract-caller (var-get lending-pool-contract)) ERR-NOT-AUTHORIZED)
    (asserts! (>= (get locked vault) amount) ERR-INSUFFICIENT-BALANCE)
    (map-set vaults borrower {
      deposited: (get deposited vault),
      locked: (- (get locked vault) amount)
    })
    (ok amount)
  )
)

(define-public (seize-collateral (borrower principal) (amount uint) (liquidator principal))
  (let (
    (vault (unwrap! (map-get? vaults borrower) ERR-VAULT-NOT-FOUND))
  )
    (asserts! (is-eq contract-caller (var-get lending-pool-contract)) ERR-NOT-AUTHORIZED)
    (asserts! (>= (get deposited vault) amount) ERR-INSUFFICIENT-BALANCE)
    (try! (as-contract (stx-transfer? amount tx-sender liquidator)))
    (map-set vaults borrower {
      deposited: (- (get deposited vault) amount),
      locked: (if (>= (get locked vault) amount)
                  (- (get locked vault) amount)
                  u0)
    })
    (var-set total-collateral (- (var-get total-collateral) amount))
    (ok amount)
  )
)

(define-read-only (get-vault (owner principal))
  (ok (default-to { deposited: u0, locked: u0 } (map-get? vaults owner)))
)

(define-read-only (get-available-collateral (owner principal))
  (let ((vault (default-to { deposited: u0, locked: u0 } (map-get? vaults owner))))
    (ok (- (get deposited vault) (get locked vault)))
  )
)

(define-read-only (get-total-collateral)
  (ok (var-get total-collateral))
)
