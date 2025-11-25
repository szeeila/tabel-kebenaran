
      document.getElementById("backspaceBtn").addEventListener("click", () => {
        const inp = document.getElementById("expressionInput");
        inp.value = inp.value.slice(0, -1);
        inp.focus();
      });

      const OPS = {
        "¬": { prec: 8, assoc: "right", arity: 1, fn: (a) => !a },
        "∧": { prec: 7, assoc: "left", arity: 2, fn: (a, b) => a && b },
        "∨": { prec: 6, assoc: "left", arity: 2, fn: (a, b) => a || b },
        "→": { prec: 5, assoc: "right", arity: 2, fn: (a, b) => !a || b },
        "↔": { prec: 4, assoc: "left", arity: 2, fn: (a, b) => a === b },
        "|": { prec: 3, assoc: "left", arity: 2, fn: (a, b) => !(a && b) },
        "↓": { prec: 2, assoc: "left", arity: 2, fn: (a, b) => !(a || b) },
        "⊕": { prec: 1, assoc: "left", arity: 2, fn: (a, b) => a !== b },
      };

      document.querySelectorAll(".symbol-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const inp = document.getElementById("expressionInput");
          inp.value += btn.textContent;
          inp.focus();
        });
      });

      function tokenize(s) {
        const tokens = [];
        let i = 0;
        while (i < s.length) {
          const ch = s[i];
          if (/\s/.test(ch)) {
            i++;
            continue;
          }
          if (ch === "(" || ch === ")") {
            tokens.push(ch);
            i++;
            continue;
          }
          if (/[A-Za-z]/.test(ch)) {
            tokens.push(ch.toUpperCase());
            i++;
            continue;
          }
          if (s.slice(i, i + 3) === "<->") {
            tokens.push("↔");
            i += 3;
            continue;
          }
          if (s.slice(i, i + 2) === "->") {
            tokens.push("→");
            i += 2;
            continue;
          }
          if (ch === "~") {
            tokens.push("¬");
            i++;
            continue;
          }
          if (ch === "^") {
            tokens.push("∧");
            i++;
            continue;
          }
          // NAND
          if (ch === "|") {
            tokens.push("|");
            i++;
            continue;
          }

          // OR pakai v atau V
          if (ch === "v" || ch === "V") {
            tokens.push("∨");
            i++;
            continue;
          }

          if (Object.keys(OPS).includes(ch)) {
            tokens.push(ch);
            i++;
            continue;
          }
          tokens.push(ch);
          i++;
        }
        return tokens;
      }

      function toRPN(tokens) {
        const out = [];
        const st = [];
        for (const t of tokens) {
          if (/[A-Z]/.test(t)) {
            out.push({ type: "var", val: t });
          } else if (t === "(") {
            st.push(t);
          } else if (t === ")") {
            while (st.length && st[st.length - 1] !== "(")
              out.push({ type: "op", val: st.pop() });
            if (st.length && st[st.length - 1] === "(") st.pop();
            else throw new Error("Kurung tidak cocok");
          } else if (OPS[t]) {
            const o1 = OPS[t];
            while (st.length) {
              const top = st[st.length - 1];
              if (!OPS[top]) break;
              const o2 = OPS[top];
              if (
                (o1.assoc === "left" && o1.prec <= o2.prec) ||
                (o1.assoc === "right" && o1.prec < o2.prec)
              ) {
                out.push({ type: "op", val: st.pop() });
              } else break;
            }
            st.push(t);
          } else throw new Error("Operator/token tidak dikenali: " + t);
        }
        while (st.length) {
          const x = st.pop();
          if (x === "(" || x === ")") throw new Error("Kurung tidak cocok");
          out.push({ type: "op", val: x });
        }
        return out;
      }

      function evalRPNWithSteps(rpn, rowVals) {
        const stack = [];
        const steps = [];
        for (const token of rpn) {
          if (token.type === "var") {
            stack.push({ label: token.val, val: !!rowVals[token.val] });
          } else if (token.type === "op") {
            const op = token.val;
            const meta = OPS[op];
            if (meta.arity === 1) {
              const a = stack.pop();
              const res = meta.fn(a.val);
              const label = `(${op}${a.label})`;
              steps.push({ label, value: !!res });
              stack.push({ label, val: !!res });
            } else {
              const b = stack.pop();
              const a = stack.pop();
              const res = meta.fn(a.val, b.val);
              const label = `(${a.label} ${op} ${b.label})`;
              steps.push({ label, value: !!res });
              stack.push({ label, val: !!res });
            }
          }
        }
        if (stack.length !== 1) throw new Error("Ekspresi tidak lengkap");
        return { result: stack[0].val, steps };
      }

      function detectVariables(expr) {
        const arr = expr.toUpperCase().match(/[A-Z]/g);
        if (!arr) return [];
        const seen = new Set();
        const out = [];
        for (const c of arr)
          if (!seen.has(c)) {
            seen.add(c);
            out.push(c);
          }
        return out;
      }

      function generateTruthTable(expr) {
        const tokens = tokenize(expr);
        const rpn = toRPN(tokens);
        const vars = detectVariables(expr);
        if (vars.length === 0)
          throw new Error("Tidak ada variabel (A-Z) ditemukan");
        const rows = [];
        const n = vars.length;
        const total = 1 << n;
        for (let i = 0; i < total; i++) {
          const vals = {};
          for (let j = 0; j < n; j++)
            vals[vars[j]] = !!(i & (1 << (n - 1 - j)));
          const ev = evalRPNWithSteps(rpn, vals);
          rows.push({ vals, result: ev.result, steps: ev.steps });
        }
        return { rows, vars };
      }

      function renderTable(rows, vars, expr, tableEl) {
        const seenLabels = new Set();
        let negationLabels = [];
        let otherLabels = [];

        // KUMPULKAN LABEL LANGKAH
        for (const r of rows) {
          for (const s of r.steps) {
            if (!seenLabels.has(s.label)) {
              seenLabels.add(s.label);

              // Kalau langkah ini adalah negasi (misal "(¬A)")
              if (/^\(¬/.test(s.label)) {
                negationLabels.push(s.label);
              } else {
                otherLabels.push(s.label);
              }
            }
          }
        }

        // Susunan label kolom:
        // VARIABEL | SEMUA NEGASI | BARU LANGKAH OPERASI LAIN | HASIL AKHIR
        const stepLabels = [...negationLabels, ...otherLabels];

        const headerCols = [...vars, ...stepLabels, expr];

        let html = "<tr>";
        headerCols.forEach((c) => (html += `<th>${c}</th>`));
        html += "</tr>";

        // TAMPILKAN ISI BARIS
        for (const r of rows) {
          html += "<tr>";

          // VARIABEL
          for (const v of vars) {
            html += `<td class="${r.vals[v] ? "b" : "s"}">${
              r.vals[v] ? "B" : "S"
            }</td>`;
          }

          // LANGKAH PERHITUNGAN
          for (const lbl of stepLabels) {
            const st = r.steps.find((x) => x.label === lbl);
            if (st) {
              html += `<td class="${st.value ? "b" : "s"}">${
                st.value ? "B" : "S"
              }</td>`;
            } else {
              html += "<td>-</td>";
            }
          }

          // HASIL AKHIR
          html += `<td class="${r.result ? "b" : "s"}">${
            r.result ? "B" : "S"
          }</td>`;
          html += "</tr>";
        }

        tableEl.innerHTML = html;
      }

      function generateCNFFromRows(rows, vars) {
        const clauses = [];
        for (const r of rows) {
          if (!r.result) {
            const parts = [];
            for (const v of vars) {
              parts.push(r.vals[v] ? `¬${v}` : `${v}`);
            }
            clauses.push("(" + parts.join(" ∨ ") + ")");
          }
        }
        return clauses.length ? clauses.join(" ∧ ") : "T";
      }

      function generateDNFFromRows(rows, vars) {
        const terms = [];
        for (const r of rows) {
          if (r.result) {
            const parts = [];
            for (const v of vars) {
              parts.push(r.vals[v] ? v : `¬${v}`);
            }
            terms.push("(" + parts.join(" ∧ ") + ")");
          }
        }
        return terms.length ? terms.join(" ∨ ") : "F";
      }

      // event listeners
      document.getElementById("generateBtn").addEventListener("click", () => {
        const raw = document.getElementById("expressionInput").value.trim();
        if (!raw) {
          alert("Input rumusnya dulu yaa");
          return;
        }
        try {
          const { rows, vars } = generateTruthTable(raw);
          renderTable(rows, vars, raw, document.getElementById("truthTable"));
        } catch (err) {
          alert(err.message);
        }
      });

      document
        .getElementById("generateCNFBtn")
        .addEventListener("click", () => {
          const raw = document.getElementById("expressionInput").value.trim();
          if (!raw) {
            alert("Input rumusnya dulu yaa");
            return;
          }
          try {
            const { rows, vars } = generateTruthTable(raw);
            const cnfExpr = generateCNFFromRows(rows, vars);
            renderTable(
              rows,
              vars,
              cnfExpr,
              document.getElementById("cnfTable")
            );
          } catch (err) {
            alert(err.message);
          }
        });

      document
        .getElementById("generateDNFBtn")
        .addEventListener("click", () => {
          const raw = document.getElementById("expressionInput").value.trim();
          if (!raw) {
            alert("Input rumusnya dulu yaa");
            return;
          }
          try {
            const { rows, vars } = generateTruthTable(raw);
            const dnfExpr = generateDNFFromRows(rows, vars);
            renderTable(
              rows,
              vars,
              dnfExpr,
              document.getElementById("dnfTable")
            );
          } catch (err) {
            alert(err.message);
          }
        });

      // tombol Reset
      document.getElementById("resetBtn").addEventListener("click", () => {
        document.getElementById("expressionInput").value = "";
        document.getElementById("truthTable").innerHTML = "";
        document.getElementById("cnfTable").innerHTML = "";
        document.getElementById("dnfTable").innerHTML = "";
      });