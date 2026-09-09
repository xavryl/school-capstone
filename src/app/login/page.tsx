import LoginForms from './LoginForms';

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/request';

  return (
    <main className="wrap narrow stack-lg">
      <header className="stack">
        <span className="eyebrow">Account</span>
        <h1>Sign in</h1>
        <p className="lede">
          Students and staff sign in here. Guests do not need an account — use the
          guest inquiry form instead.
        </p>
      </header>

      <LoginForms next={target} />
    </main>
  );
}
