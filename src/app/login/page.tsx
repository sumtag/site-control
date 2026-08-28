import { signIn } from "@/auth";

const DEMO_USERS = [
  { email: "super@example.com", label: "Superintendent" },
  { email: "contractor@example.com", label: "Contractor" },
  { email: "client@example.com", label: "Client" },
];

const entraConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
);

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">Site Control</div>
        <div className="tag">Construction Document Control</div>
        {entraConfigured ? (
          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: "/projects" });
            }}
          >
            <button type="submit" className="btn">
              Sign in with Microsoft
            </button>
          </form>
        ) : (
          <button type="button" className="btn" disabled>
            Sign in with Microsoft
          </button>
        )}
        <div className="hint" style={{ marginTop: 16 }}>
          {entraConfigured
            ? "Spiire staff and invited contractor/client guests sign in with their Microsoft account. Ad-hoc external access (email link) is coming in a later phase."
            : "Microsoft sign-in isn't configured yet — it needs an Entra app registration (see setup notes)."}
        </div>

        {process.env.NODE_ENV !== "production" && (
          <>
            <div className="divider" />
            <div className="hint" style={{ marginBottom: 10 }}>
              Dev only — Entra isn&apos;t configured yet, so sign in as a
              seeded demo user to look around.
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {DEMO_USERS.map((u) => (
                <form
                  key={u.email}
                  action={async () => {
                    "use server";
                    await signIn("dev-demo", {
                      email: u.email,
                      redirectTo: "/projects",
                    });
                  }}
                >
                  <button type="submit" className="btn secondary sm">
                    Continue as demo {u.label}
                  </button>
                </form>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
