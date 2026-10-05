import { useAuth } from "../auth/authContext";

/* Nav-bar auth control: "Sign in" button, or the signed-in user with a "Sign out" link. */
export default function NavAuth() {
  const { user, loading, openAuth, logout } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <button className="btn-outline nav-auth-btn" onClick={() => openAuth("login")}>
        Sign in
      </button>
    );
  }

  const label = user.name || user.email;
  return (
    <div className="nav-user" title={user.email}>
      {user.avatar_url
        ? <img className="nav-user-avatar" src={user.avatar_url} alt="" referrerPolicy="no-referrer" />
        : <span className="nav-user-avatar nav-user-initial">{label[0].toUpperCase()}</span>}
      <span className="nav-user-name">{label.split(" ")[0]}</span>
      <button className="nav-link nav-signout" onClick={logout}>Sign out</button>
    </div>
  );
}
