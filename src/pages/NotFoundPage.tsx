import { Link } from 'react-router-dom';

export function NotFoundPage(): React.JSX.Element {
  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <span className="card-title">404 — no such page</span>
        </div>
        <p className="muted">
          The route does not exist. Pick an algorithm from the sidebar, or head back to the home
          page.
        </p>
        <div className="btn-row">
          <Link className="btn" to="/">
            ← Back home
          </Link>
          <Link className="btn" to="/atlas">
            Browse the atlas
          </Link>
        </div>
      </section>
    </div>
  );
}