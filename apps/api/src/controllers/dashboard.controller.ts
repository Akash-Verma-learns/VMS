import { Response } from 'express';
import { prismaRead } from '../lib/prisma'; // Notice we are explicitly using the Replica!

export const getWarRoomSnapshot = async (req: any, res: Response) => {
  try {
    const { examId } = req.query;

    if (!examId) {
      return res.status(400).json({ success: false, message: 'examId is required to load the War Room' });
    }

    // Promise.all runs these heavy queries in parallel, making the dashboard load instantly
    const [
      totalAssignedVenues,
      highRiskVenues,
      completedInspections,
      missingReadinessReports
    ] = await Promise.all([
      // 1. How many venues are participating?
      prismaRead.venueAssignment.count({
        where: { examId }
      }),

      // 2. How many venues have been flagged by the Inspection Module?
      prismaRead.venue.count({
        where: { isHighRisk: true }
      }),

      // 3. How many inspections are totally finished?
      prismaRead.inspection.count({
        where: { examId, status: { in: ['SUBMITTED', 'REVIEWED'] } }
      }),

      // 4. Who hasn't reported in yet? (Non-reporting alerts)
      prismaRead.venueReadiness.count({
        where: { examId, status: 'PENDING' }
      })
    ]);

    // Send the aggregated dashboard data back to the frontend
    return res.status(200).json({
      success: true,
      data: {
        totalAssignedVenues,
        highRiskVenues,
        completedInspections,
        missingReadinessReports,
        lastUpdated: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error("War Room Aggregation Error:", error);
    return res.status(500).json({ success: false, message: "Failed to compile War Room data." });
  }
};