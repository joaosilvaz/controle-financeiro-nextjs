export default function SetupGate() {
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-brand">
          <div className="brand-mark">CF</div>
          <h2 style={{ margin: 0 }}>Configuração pendente</h2>
        </div>
        <p>
          Este site ainda não está ligado ao banco de dados da família. Configure as variáveis de
          ambiente do Firebase (<code>NEXT_PUBLIC_FIREBASE_*</code>) no projeto — na Vercel, em
          Settings → Environment Variables.
        </p>
        <ol>
          <li>Crie um projeto gratuito em <code>console.firebase.google.com</code></li>
          <li>Ative <strong>Authentication → E-mail/senha</strong></li>
          <li>Crie um <strong>Firestore Database</strong></li>
          <li>Copie as chaves do app da Web e cole nas variáveis de ambiente</li>
        </ol>
        <p style={{ marginTop: 14 }}>
          Veja o guia completo em <code>GUIA_CONFIGURACAO.md</code>.
        </p>
      </div>
    </div>
  );
}
