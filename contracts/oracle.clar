;; AnchorFi Price Oracle
;; Owner-controlled price feed for STX/USD

(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-INVALID-PRICE (err u101))
(define-constant ERR-STALE-PRICE (err u102))

(define-constant PRICE_PRECISION u1000000) ;; 6 decimals
(define-constant MAX_PRICE_AGE u144)       ;; ~1 day in blocks

(define-data-var contract-owner principal tx-sender)
(define-data-var stx-price uint u0)
(define-data-var last-updated-block uint u0)

(define-public (set-price (new-price uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (asserts! (> new-price u0) ERR-INVALID-PRICE)
    (var-set stx-price new-price)
    (var-set last-updated-block stacks-block-height)
    (ok new-price)
  )
)

(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set contract-owner new-owner)
    (ok new-owner)
  )
)

(define-read-only (get-price)
  (let ((updated-at (var-get last-updated-block)))
    (asserts! (> updated-at u0) ERR-STALE-PRICE)
    (asserts! (<= (- stacks-block-height updated-at) MAX_PRICE_AGE) ERR-STALE-PRICE)
    (ok (var-get stx-price))
  )
)

(define-read-only (get-price-unsafe)
  (ok (var-get stx-price))
)

(define-read-only (get-last-updated)
  (ok (var-get last-updated-block))
)

(define-read-only (get-owner)
  (ok (var-get contract-owner))
)

(define-read-only (get-precision)
  (ok PRICE_PRECISION)
)
