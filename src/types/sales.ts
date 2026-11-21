import { BillingCycle, BusinessType } from './index';

export type SalesMemberRole = 'salesman' | 'senior_salesman' | 'sales_manager';
export type SalesAccountStatus = 'active' | 'inactive' | 'suspended' | 'invited';
export type SalesEmploymentStatus = 'full_time' | 'part_time' | 'contract' | 'probation';

export type SalesLeadStatus =
  | 'New'
  | 'Assigned'
  | 'Contacted'
  | 'Interested'
  | 'Follow-up Required'
  | 'Demo Scheduled'
  | 'Negotiation'
  | 'Converted'
  | 'Not Interested'
  | 'Lost';

export type SalesLeadSource =
  | 'field_visit'
  | 'referral'
  | 'inbound_web'
  | 'whatsapp'
  | 'cold_call'
  | 'csv_import'
  | 'event';

export type SalesActivityType =
  | 'Business visit'
  | 'Phone call'
  | 'WhatsApp follow-up'
  | 'Product demo'
  | 'Online meeting'
  | 'Shop registration assistance'
  | 'Subscription follow-up';

export type SalesActivityResult =
  | 'completed'
  | 'positive'
  | 'follow_up_needed'
  | 'no_answer'
  | 'rescheduled'
  | 'converted';

export type CommissionStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'reversed';
export type CommissionEntryType =
  | 'subscription_first'
  | 'subscription_renewal'
  | 'target_bonus'
  | 'manual_adjustment';

export type PayoutMethod = 'bank_transfer' | 'easypaisa' | 'jazzcash';

export interface SalesMember {
  id: string;
  uid?: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address?: string;
  profilePicture?: string;
  role: SalesMemberRole;
  assignedManagerId?: string;
  assignedManagerUid?: string;
  assignedManagerName?: string;
  teamId?: string;
  teamName?: string;
  territory: string;
  industryFocus: BusinessType | 'all';
  joiningDate: string;
  employmentStatus: SalesEmploymentStatus;
  monthlyTarget: number;
  yearlyTarget: number;
  commissionPlanId: string;
  commissionPlanName: string;
  accountStatus: SalesAccountStatus;
  referralCode: string;
  referralLink: string;
  qrScanCount: number;
  payoutDetails?: {
    preferredMethod: PayoutMethod;
    accountTitle: string;
    accountNumber: string;
    bankName?: string;
    iban?: string;
  };
  inviteStatus?: 'pending' | 'accepted';
  invitedAt?: string;
  acceptedAt?: string;
  lastLoginAt?: string;
  lastActivityAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SalesTeam {
  id: string;
  name: string;
  managerMemberId: string;
  managerUid?: string;
  managerName: string;
  territory: string;
  cities: string[];
  memberIds: string[];
  monthlyTeamTarget: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SalesLead {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  normalizedEmail?: string;
  city: string;
  industry: BusinessType;
  businessAddress?: string;
  assignedSalesmanId?: string;
  assignedSalesmanUid?: string;
  assignedSalesmanName?: string;
  assignedManagerId?: string;
  assignedManagerUid?: string;
  leadSource: SalesLeadSource;
  expectedPlanId?: string;
  expectedPlanName?: string;
  nextFollowUpDate?: string;
  notes?: string;
  status: SalesLeadStatus;
  convertedShopId?: string;
  convertedShopSlug?: string;
  duplicateResolutionNote?: string;
  lastContactAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SalesActivity {
  id: string;
  salesmanId: string;
  salesmanUid?: string;
  salesmanName: string;
  leadId?: string;
  leadName?: string;
  shopId?: string;
  shopName?: string;
  activityType: SalesActivityType;
  activityDateTime: string;
  notes: string;
  nextFollowUpDate?: string;
  resultStatus: SalesActivityResult;
  createdAt: string;
}

export interface SalesTarget {
  id: string;
  salesmanId: string;
  salesmanUid?: string;
  salesmanName: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  periodKey: string;
  dailyActivityTarget: number;
  weeklyLeadTarget: number;
  monthlyRegistrationTarget: number;
  monthlyPaidSubscriptionTarget: number;
  revenueTarget: number;
  conversionTarget: number;
  bonusAmount: number;
  bonusThresholdPct: number;
  notes?: string;
  updatedBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReferralAttribution {
  id: string;
  referralCode: string;
  salesmanId: string;
  salesmanUid?: string;
  salesmanName: string;
  shopId: string;
  shopSlug: string;
  shopName: string;
  ownerId: string;
  ownerEmail: string;
  ownerPhone?: string;
  city?: string;
  industry?: BusinessType;
  leadId?: string;
  source: 'referral_link' | 'qr_scan' | 'manual_assisted' | 'code_entry';
  attributionStatus: 'registered' | 'verified' | 'subscribed' | 'rejected_self_referral' | 'duplicate_blocked';
  firstPaymentId?: string;
  totalRevenueGenerated: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CommissionRuleTier {
  id: string;
  name: string;
  firstSubRatePct: number;
  renewalRatePct: number;
  verifiedShopBonus: number;
  yearlyPlanBonusPct: number;
  minRevenueForBonus: number;
  targetBonusAmount: number;
}

export interface CommissionLedgerEntry {
  id: string;
  salesmanId: string;
  salesmanUid?: string;
  salesmanName: string;
  shopId: string;
  shopName: string;
  paymentId: string;
  attributionId?: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  paymentAmount: number;
  commissionRatePct: number;
  flatBonusAmount: number;
  commissionAmount: number;
  commissionType: CommissionEntryType;
  status: CommissionStatus;
  rejectionReason?: string;
  reversalReason?: string;
  payoutId?: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CommissionPayout {
  id: string;
  payoutNumber: string;
  salesmanId: string;
  salesmanUid?: string;
  salesmanName: string;
  salesmanEmail: string;
  ledgerEntryIds: string[];
  totalAmount: number;
  method: PayoutMethod;
  accountTitle: string;
  accountNumber: string;
  bankName?: string;
  transactionReference: string;
  notes?: string;
  status: 'processed' | 'reversed';
  processedBy: string;
  processedAt: string;
  createdAt: string;
}

export type SalesNotificationType =
  | 'lead_assigned'
  | 'follow_up_due'
  | 'lead_converted'
  | 'shop_registered'
  | 'subscription_paid'
  | 'commission_approved'
  | 'commission_rejected'
  | 'payout_processed'
  | 'target_achieved';

export interface SalesNotification {
  id: string;
  recipientSalesmanId: string; // 'super_admin' or SalesMember.id
  recipientUid?: string;
  type: SalesNotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface SalesQrEvent {
  id: string;
  salesmanId: string;
  referralCode: string;
  source: 'qr_scan' | 'referral_link';
  userAgent?: string;
  convertedShopId?: string;
  createdAt: string;
}

export interface SalesAuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: 'super_admin' | 'sales_manager' | 'salesman' | 'system';
  action: string;
  entityType:
    | 'sales_member'
    | 'sales_team'
    | 'sales_lead'
    | 'sales_activity'
    | 'sales_target'
    | 'referral'
    | 'commission'
    | 'payout'
    | 'qr_code'
    | 'sales_settings';
  entityId: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface SalesSettings {
  id: string;
  portalBaseUrl: string;
  defaultFirstSubRatePct: number;
  defaultRenewalRatePct: number;
  verifiedShopFlatBonus: number;
  yearlyBonusExtraPct: number;
  minPayoutThreshold: number;
  attributionWindowDays: number;
  allowManualReferralEntry: boolean;
  preventSelfReferral: boolean;
  autoSyncCommissionOnPaymentApproval: boolean;
  commissionPlans: CommissionRuleTier[];
  updatedAt?: string;
}

export type SalesDatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'all_time'
  | 'custom';

export interface SalesAnalyticsFilter {
  preset: SalesDatePreset;
  customStart?: string;
  customEnd?: string;
  salesmanId?: string;
  managerId?: string;
  city?: string;
  industry?: BusinessType | 'all';
}

export interface SalesAnalyticsSummary {
  totalSalesmen: number;
  activeSalesmen: number;
  inactiveSalesmen: number;
  totalAssignedLeads: number;
  newLeads: number;
  followUpRequiredLeads: number;
  convertedLeads: number;
  totalRegisteredShops: number;
  verifiedShops: number;
  paidSubscriptions: number;
  totalSalesRevenue: number;
  totalCommissionGenerated: number;
  pendingCommission: number;
  commissionPaid: number;
  dailyPerformanceChart: { label: string; value: number; secondary?: number }[];
  monthlyPerformanceChart: { label: string; value: number }[];
  salesmanConversionsChart: { label: string; value: number }[];
  leadsVsRegistrations: { label: string; leads: number; registrations: number }[];
  revenueBySalesmanChart: { label: string; value: number }[];
  commissionDistribution: { label: string; count: number; color: string }[];
  targetVsAchievement: {
    salesmanId: string;
    salesmanName: string;
    target: number;
    achieved: number;
    pct: number;
    conversionRate: number;
  }[];
  industryBreakdown: { label: string; count: number; color: string }[];
}
