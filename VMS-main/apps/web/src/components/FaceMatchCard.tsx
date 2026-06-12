interface FaceMatchCardProps {
  venuePhotoUrl: string
  venuePhotoCaption: string
  refPhotoUrl: string
  refLabel: string
  distance: number
  matched: boolean
  reviewStatus: string
  resultId: string
  onReview?: (resultId: string, status: string, note: string) => void
  showReviewActions?: boolean
}

export function FaceMatchCard({
  venuePhotoUrl,
  venuePhotoCaption,
  refPhotoUrl,
  refLabel,
  distance,
  matched,
  reviewStatus,
  resultId,
  onReview,
  showReviewActions = false,
}: FaceMatchCardProps) {
  function getConfidenceLabel(): string {
    if (distance < 0.4) return '🔴 VERY HIGH CONFIDENCE MATCH'
    if (distance <= 0.6) return '🟡 POSSIBLE MATCH'
    return '🟢 NO MATCH'
  }

  function getStatusBadge(): string {
    switch (reviewStatus) {
      case 'CONFIRMED_MATCH': return '✅ Confirmed Match'
      case 'FALSE_POSITIVE': return '❌ False Positive'
      case 'INCONCLUSIVE': return '❓ Inconclusive'
      default: return '⏳ Pending Review'
    }
  }

  return (
    <div className={`face-match-card ${matched ? 'flagged' : 'clear'}`}>
      <div className="fmc-photos">
        <div className="fmc-photo-box">
          <img src={venuePhotoUrl} alt="Venue photo" className="fmc-photo" />
          <div className="fmc-caption">{venuePhotoCaption}</div>
        </div>
        <div className="fmc-vs">vs</div>
        <div className="fmc-photo-box">
          <img src={refPhotoUrl} alt="Reference photo" className="fmc-photo" />
          <div className="fmc-caption">{refLabel}</div>
        </div>
      </div>

      <div className="fmc-score">
        <div className="fmc-distance">Distance: {distance.toFixed(3)}</div>
        <div className="fmc-confidence">{getConfidenceLabel()}</div>
      </div>

      <div className="fmc-review-status">{getStatusBadge()}</div>

      {showReviewActions && reviewStatus === 'PENDING_REVIEW' && onReview && (
        <div className="fmc-review-actions">
          <button
            className="fmc-review-btn confirm"
            onClick={() => onReview(resultId, 'CONFIRMED_MATCH', '')}
          >
            Confirmed Match
          </button>
          <button
            className="fmc-review-btn false-pos"
            onClick={() => onReview(resultId, 'FALSE_POSITIVE', '')}
          >
            False Positive
          </button>
          <button
            className="fmc-review-btn inconclusive"
            onClick={() => onReview(resultId, 'INCONCLUSIVE', '')}
          >
            Inconclusive
          </button>
        </div>
      )}
    </div>
  )
}
