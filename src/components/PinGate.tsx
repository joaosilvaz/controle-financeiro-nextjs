"use client";

import { useState, type KeyboardEvent } from "react";

export default function PinGate({
  pinCorreto,
  onSucesso,
}: {
  pinCorreto: string;
  onSucesso: () => void;
}) {
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState(false);

  function tentar() {
    if (valor.trim() === pinCorreto) {
      setErro(false);
      onSucesso();
    } else {
      setErro(true);
      setValor("");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") tentar();
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-brand">
          <div className="brand-mark">CF</div>
          <div>
            <h2 style={{ margin: 0 }}>Controle Financeiro</h2>
            <p style={{ margin: "2px 0 0" }}>Acesso da família</p>
          </div>
        </div>
        <label style={{ marginBottom: 8 }}>Digite o PIN</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          placeholder="••••"
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button onClick={tentar}>Entrar</button>
        {erro && <div className="err">PIN incorreto. Tente de novo.</div>}
      </div>
    </div>
  );
}
