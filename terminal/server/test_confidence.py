"""
Tests for the AS608 -> VMS confidence mapping.

This is the one piece of arithmetic in the gate that can be wrong without
anything looking wrong. The sensor reports a match score on its own open-ended
scale; the VMS stores a 0-100 confidence and flags anything below 70 for manual
review. Two independent decisions are derived from one raw score — whether the
gate opens, and whether the record is flagged — and they are made in different
places. If they disagree, the terminal admits a candidate while filing them as
suspect, or refuses one whose record reads as a clean pass. Neither shows up in
a demo; both are serious in a hall.

The boundary at exactly FP_MIN_CONFIDENCE is the case that actually broke: the
gate accepted `raw >= 50` while the mapping treated `raw <= 50` as a rejection,
so a score of precisely 50 opened the gate and was logged at 69 — flagged.

Run:  python3 -m pytest test_confidence.py -q      (or: python3 test_confidence.py)
"""

import sys
import unittest

from server import (
    FP_FULL_CONFIDENCE,
    FP_MIN_CONFIDENCE,
    VMS_FLAG_THRESHOLD,
    normalise_confidence,
)


def gate_accepts(raw: int) -> bool:
    """The accept test as identify() applies it. Must agree with the mapping."""
    return raw >= FP_MIN_CONFIDENCE


class ConfidenceMapping(unittest.TestCase):
    def test_rejected_scores_land_below_the_flag_threshold(self):
        for raw in (0, 1, 25, FP_MIN_CONFIDENCE - 1):
            self.assertLess(normalise_confidence(raw), VMS_FLAG_THRESHOLD)

    def test_a_perfect_score_does_not_claim_certainty(self):
        # 99 rather than 100: a biometric match is evidence, not proof, and a
        # displayed 100% invites an operator to stop looking at the candidate.
        self.assertEqual(normalise_confidence(FP_FULL_CONFIDENCE), 99.0)
        self.assertEqual(normalise_confidence(FP_FULL_CONFIDENCE + 500), 99.0)

    def test_the_boundary_agrees_with_the_gate(self):
        """The regression: accepting a score the record then calls flagged."""
        raw = FP_MIN_CONFIDENCE
        self.assertTrue(gate_accepts(raw))
        self.assertGreaterEqual(
            normalise_confidence(raw),
            VMS_FLAG_THRESHOLD,
            "a score the gate accepts must not be recorded as flagged",
        )

    def test_accept_and_flag_never_disagree_across_the_whole_range(self):
        for raw in range(0, FP_FULL_CONFIDENCE + 50):
            accepted = gate_accepts(raw)
            flagged = normalise_confidence(raw) < VMS_FLAG_THRESHOLD
            self.assertNotEqual(
                accepted,
                flagged,
                f"raw={raw}: gate accepted={accepted} but flagged={flagged}",
            )

    def test_mapping_rises_with_the_raw_score(self):
        scores = [normalise_confidence(r) for r in range(FP_MIN_CONFIDENCE, FP_FULL_CONFIDENCE)]
        self.assertEqual(scores, sorted(scores))

    def test_output_stays_inside_the_scale_the_vms_stores(self):
        for raw in range(0, FP_FULL_CONFIDENCE + 50):
            value = normalise_confidence(raw)
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 100.0)


if __name__ == "__main__":
    unittest.main(verbosity=2, exit=not sys.flags.interactive)
