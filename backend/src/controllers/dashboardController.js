import { DashboardService } from '../services/dashboardService.js';
import { AuditService } from '../services/auditService.js';

export const DashboardController = {
  /**
   * GET /api/dashboard/metrics
   */
  async getMetrics(req, res, next) {
    try {
      const metrics = await DashboardService.getMetricsByRole(req.user);
      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/dashboard/audit-recent (Solo roles directiva)
   */
  async getRecentAudit(req, res, next) {
    try {
      const logs = await AuditService.getRecentLogs(10);
      return res.status(200).json({
        success: true,
        data: logs
      });
    } catch (error) {
      next(error);
    }
  }
};
