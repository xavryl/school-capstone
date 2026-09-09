export type Department = 'registrar' | 'treasury';

export type RequestStatus =
  | 'submitted' | 'pending' | 'processing' | 'ready' | 'completed' | 'cancelled';

export type InquiryStatus = 'submitted' | 'assigned' | 'responded' | 'closed';

export type QueueState = 'waiting' | 'serving' | 'skipped' | 'completed';

/** The two pipelines are deliberately separate. Collapsing them into one
 *  status column with nine values is how the reports become unreadable. */
export const REQUEST_PIPELINE: RequestStatus[] =
  ['submitted', 'pending', 'processing', 'ready', 'completed'];

export const INQUIRY_PIPELINE: InquiryStatus[] =
  ['submitted', 'assigned', 'responded', 'closed'];

export const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  pending: 'Pending',
  processing: 'Processing',
  ready: 'Ready for pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
  assigned: 'Assigned',
  responded: 'Responded',
  closed: 'Closed',
};

export const DEPARTMENTS: { id: Department; name: string; blurb: string }[] = [
  { id: 'registrar', name: 'Registrar', blurb: 'Certificates, transcripts and document inquiries' },
  { id: 'treasury', name: 'Treasury', blurb: 'Payments, assessments and official receipts' },
];

export type Service = {
  id: number;
  department: Department;
  name: string;
  description: string | null;
  active: boolean;
};

export type ServiceWindow = {
  id: number;
  department: Department;
  label: string;
  active: boolean;
};

export type QueueTicket = {
  id: string;
  number: string;
  department: Department;
  window_id: number | null;
  state: QueueState;
  created_at: string;
  called_at: string | null;
};

export type QueueSnapshot = {
  department: Department;
  serving: { number: string; window: string; called_at: string }[];
  waiting: string[];
  as_of: string;
};
