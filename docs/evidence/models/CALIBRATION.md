# Calibrated policy model evidence notes

The logistic model is a learned pre-purchase usefulness score over public
metadata. Its score occupies the decision interface's `addressesGap` slot;
originality is a deterministic exclusion from public derivation/family metadata,
and credibility is the interface maximum (2) so that the policy's value formula preserves the score.
The existing policy still checks trust, source scope, novelty, cap, reservations,
remaining budget, and duplicate purchases before initiating any purchase.

Fit protocol: deterministic full-batch gradient descent, L2=0.002, learning
rate=0.1, 4,000 iterations, fixed buy threshold=0.20. Hash question identifiers
into train (60%), validation (20%) and test (20%) groups. Neither validation nor
test participates in fitting or threshold selection. Article families can
appear in multiple question groups; this is a question-heldout estimate, not an
unseen-topic or unseen-writer estimate.

Targets are the existing source-grounded buy annotations on open facts. Stored
Luna verdicts are separately reported pseudo labels, not human ground truth.
Price, authority and content metadata come from the current corpus; relevance
is recomputed using local hybrid search because these historical label rows do
not store the original claimed relevance. Actual fixture code provides its
baseline on exactly the same reconstructed metadata. Luna's recorded value
scores are an additional historical baseline, with their original context;
that context is not fully recoverable, so it is not a paired runtime replay.

Historical snapshots lack trust, honesty, promise-calibration and already-read
family state. Training uses documented neutral priors for those fields and
cannot establish their predictive effect. Runtime can use the current
reputation and read-family context; policy exclusions remain authoritative.
Embedding similarity is between the gap and public title/preview/tags only.
No premium passages or label fields enter features. The score cannot access a
payer or purchase manager.

The stored versioned JSON hashes its complete payload, including source-data
hashes and the fitting protocol. Re-running the fit must produce identical bytes.
