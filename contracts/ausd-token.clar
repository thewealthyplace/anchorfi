;; AnchorFi USD (aUSD) - SIP-010 Debt Token
;; Minted when users borrow, burned on repayment

(impl-trait .sip010-trait.sip010-trait)

(define-constant ERR-NOT-AUTHORIZED (err u200))
(define-constant ERR-NOT-TOKEN-OWNER (err u201))
(define-constant ERR-INSUFFICIENT-BALANCE (err u202))

(define-fungible-token ausd)

(define-data-var contract-owner principal tx-sender)
(define-data-var minter principal tx-sender)
(define-data-var token-uri (optional (string-utf8 256)) none)

(define-public (set-minter (new-minter principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set minter new-minter)
    (ok new-minter)
  )
)

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq contract-caller (var-get minter)) ERR-NOT-AUTHORIZED)
    (ft-mint? ausd amount recipient)
  )
)

(define-public (burn (amount uint) (owner principal))
  (begin
    (asserts! (is-eq contract-caller (var-get minter)) ERR-NOT-AUTHORIZED)
    (ft-burn? ausd amount owner)
  )
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-TOKEN-OWNER)
    (try! (ft-transfer? ausd amount sender recipient))
    (match memo m (print m) 0x)
    (ok true)
  )
)

(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set token-uri new-uri)
    (ok true)
  )
)

(define-read-only (get-name) (ok "AnchorFi USD"))
(define-read-only (get-symbol) (ok "aUSD"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (account principal)) (ok (ft-get-balance ausd account)))
(define-read-only (get-total-supply) (ok (ft-get-supply ausd)))
(define-read-only (get-token-uri) (ok (var-get token-uri)))
(define-read-only (get-minter) (ok (var-get minter)))
