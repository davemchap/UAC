import { getDb, alertReviews } from "../db";

export type AlertReviewDecision = "approved" | "edited" | "rejected";

export interface SubmitReviewInput {
	notificationId: number;
	zoneSlug: string;
	dangerLevel: number;
	aiAlertId?: number;
	originalText: string;
	editedText?: string;
	decision: AlertReviewDecision;
	rejectionReason?: string;
	reviewerUsername: string;
	reviewerRole: string;
}

export async function submitAlertReview(input: SubmitReviewInput) {
	const db = getDb();
	const [review] = await db
		.insert(alertReviews)
		.values({
			notificationId: input.notificationId,
			zoneSlug: input.zoneSlug,
			dangerLevel: input.dangerLevel,
			aiAlertId: input.aiAlertId ?? null,
			originalText: input.originalText,
			editedText: input.editedText ?? null,
			decision: input.decision,
			rejectionReason: input.rejectionReason ?? null,
			reviewerUsername: input.reviewerUsername,
			reviewerRole: input.reviewerRole,
		})
		.returning();
	return review;
}
