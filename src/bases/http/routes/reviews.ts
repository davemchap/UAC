import { Hono } from "hono";
import { submitAlertReview, type AlertReviewDecision } from "../../../components/alert-review";

const reviews = new Hono();

interface ReviewBody {
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

reviews.post("/", async (c) => {
	try {
		const {
			notificationId,
			zoneSlug,
			dangerLevel,
			aiAlertId,
			originalText,
			editedText,
			decision,
			rejectionReason,
			reviewerUsername,
			reviewerRole,
		} = await c.req.json<ReviewBody>();

		if (!notificationId || !zoneSlug || !originalText || !reviewerUsername || !reviewerRole) {
			return c.json({ success: false, error: "Missing required fields" }, 400);
		}

		const validDecisions: AlertReviewDecision[] = ["approved", "edited", "rejected"];
		if (!validDecisions.includes(decision)) {
			return c.json({ success: false, error: "Invalid decision" }, 400);
		}

		const review = await submitAlertReview({
			notificationId,
			zoneSlug,
			dangerLevel,
			aiAlertId,
			originalText,
			editedText,
			decision,
			rejectionReason,
			reviewerUsername,
			reviewerRole,
		});
		return c.json({ success: true, review });
	} catch (err) {
		console.error("Failed to submit alert review:", err);
		return c.json({ success: false, error: "Failed to submit review" }, 500);
	}
});

export default reviews;
