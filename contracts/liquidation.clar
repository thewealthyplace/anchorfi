;; AnchorFi Liquidation Registry
;; Tracks liquidation history and manages liquidator rewards

(define-constant ERR-NOT-AUTHORIZED (err u500))
(define-constant ERR-ALREADY-REGISTERED (err u501))
(define-constant ERR-NOT-REGISTERED (err u502))

(define-data-var contract-owner principal tx-sender)
(define-data-var lending-pool principal tx-sender)
(define-data-var total-liquidations uint u0)
(define-data-var total-liquidated-value uint u0)

(define-map liquidation-events
  uint
  {
    liquidator: principal,
    borrower: principal,
    debt-repaid: uint,
    collateral-seized: uint,
    block-height: uint
  }
)

(define-map liquidator-stats
  principal
  {
    total-liquidations: uint,
    total-profit: uint
  }
)

(define-public (set-lending-pool (pool principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set lending-pool pool)
    (ok pool)
  )
)

(define-public (record-liquidation
  (liquidator principal)
  (borrower principal)
  (debt-repaid uint)
  (collateral-seized uint)
)
  (let (
    (event-id (var-get total-liquidations))
    (current-stats (default-to { total-liquidations: u0, total-profit: u0 }
                               (map-get? liquidator-stats liquidator)))
    (profit (if (> collateral-seized debt-repaid) (- collateral-seized debt-repaid) u0))
  )
    (asserts! (is-eq contract-caller (var-get lending-pool)) ERR-NOT-AUTHORIZED)
    (map-set liquidation-events event-id {
      liquidator: liquidator,
      borrower: borrower,
      debt-repaid: debt-repaid,
      collateral-seized: collateral-seized,
      block-height: stacks-block-height
    })
    (map-set liquidator-stats liquidator {
      total-liquidations: (+ (get total-liquidations current-stats) u1),
      total-profit: (+ (get total-profit current-stats) profit)
    })
    (var-set total-liquidations (+ event-id u1))
    (var-set total-liquidated-value (+ (var-get total-liquidated-value) debt-repaid))
    (ok event-id)
  )
)

(define-read-only (get-liquidation-event (event-id uint))
  (ok (map-get? liquidation-events event-id))
)

(define-read-only (get-liquidator-stats (liquidator principal))
  (ok (default-to { total-liquidations: u0, total-profit: u0 }
                  (map-get? liquidator-stats liquidator)))
)

(define-read-only (get-total-liquidations)
  (ok (var-get total-liquidations))
)

(define-read-only (get-total-liquidated-value)
  (ok (var-get total-liquidated-value))
)
