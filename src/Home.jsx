export default function Home() {
  return (
    <main
      style={{
        fontFamily: "sans-serif",
        padding: "2rem",
        maxWidth: "700px",
        margin: "auto",
      }}
    >
      {/* Hero Section */}
      <section style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "1rem" }}>
          BaseBro
        </h1>
        <p style={{ fontSize: "1.2rem" }}>
          Smart P2P Payments. Anywhere. Anytime.
        </p>
        <a
          href="https://wa.me/your-number-here"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: "1.5rem",
            padding: "0.75rem 1.5rem",
            backgroundColor: "#0070f3",
            color: "white",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Try WhatsApp Demo
        </a>
      </section>

      {/* How It Works */}
      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontSize: "1.8rem", fontWeight: 600, marginBottom: "1rem" }}>
          How It Works
        </h2>
        <ul style={{ listStyle: "none", paddingLeft: 0, lineHeight: "1.8" }}>
          <li><strong>Chat:</strong> Start on WhatsApp</li>
          <li><strong>AI Parses:</strong> We understand your intent</li>
          <li><strong>Escrow:</strong> Lock funds with smart contract</li>
          <li><strong>Release:</strong> Funds released once deal confirmed</li>
        </ul>
      </section>
    </main>
  );
}
