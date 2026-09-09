import type { Department } from '@/lib/types';
import InquiryForm from './InquiryForm';

type Props = {
  searchParams: Promise<{ dept?: string; subject?: string; body?: string }>;
};

export default async function InquiryPage({ searchParams }: Props) {
  const { dept, subject, body } = await searchParams;
  const initialDept: Department = dept === 'treasury' ? 'treasury' : 'registrar';

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Guests &amp; visitors</span>
        <h1>Send an inquiry</h1>
        <p className="lede">
          No account needed. You will get a reference number you can use to follow
          the reply.
        </p>
      </header>

      <InquiryForm
        initialDept={initialDept}
        initialSubject={subject ?? ''}
        initialBody={body ?? ''}
      />
    </main>
  );
}
