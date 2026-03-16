📋 MÓDULOS DISPONÍVEIS PARA DOCUMENTAR:
✅ JÁ DOCUMENTADO:
✅ APPOINTMENTS (8 rotas) - COMPLETO
   └─ Incluindo correção do searchByPatient

📝 MÓDULOS PENDENTES:
✅  PROFESSIONALS (4 rotas)
GET  /professionals?company_id={id}
GET  /professionals/{company_id}
GET  /professionals/{company_id}/{user_id}
GET  /professionals/{company_id}/occupations
Complexidade: 🟢 BAIXA
Importância: ⭐⭐⭐⭐⭐ (fundamental)

✅ SCHEDULES (4 rotas)
GET  /schedules/{company_id}
GET  /schedules/{company_id}/{user_id}
GET  /schedules/{company_id}/availability/{user_id}
GET  /schedules/{company_id}/available-slots/{user_id}
Complexidade: 🟡 MÉDIA
Importância: ⭐⭐⭐⭐⭐ (fundamental)

3️⃣ PATIENTS (5 rotas)
POST /patients/find-or-create
GET  /patients
GET  /patients/{id}
GET  /patients/search
PUT  /patients/{id}
Complexidade: 🟢 BAIXA
Importância: ⭐⭐⭐⭐⭐ (fundamental)

4️⃣ NOTIFICATIONS (4 rotas)
POST /notifications/send-whatsapp
POST /notifications/send-batch
GET  /notifications/check-whatsapp/{phone}
GET  /notifications/status
Complexidade: 🟡 MÉDIA
Importância: ⭐⭐⭐⭐ (importante)

5️⃣ SYNC (4 rotas)
POST /sync/google-calendar
GET  /sync/google-calendar/{company_id}
PUT  /sync/google-calendar/{company_id}/{user_id}/toggle
DELETE /sync/google-calendar/{company_id}/{user_id}
Complexidade: 🟡 MÉDIA
Importância: ⭐⭐⭐ (útil)

6️⃣ TISS (7 rotas) ⚠️
GET  /tiss/guias/pendentes?company={id}
POST /tiss/guias/importar
GET  /tiss/lotes?company={id}
POST /tiss/lotes
GET  /tiss/lotes/{id}?company={id}
GET  /tiss/lotes/{id}/xml?company={id}
PUT  /tiss/lotes/{id}/status
Complexidade: 🔴 ALTA (XML 4.01.00, regras ANS)
Importância: ⭐⭐⭐⭐⭐ (CRÍTICO para faturamento)

7️⃣ CHATWOOT (1 rota)
POST /chatwoot/sync
Complexidade: 🟢 BAIXA
Importância: ⭐⭐⭐ (útil)

8️⃣ HEALTH (1 rota)
GET  /health
Complexidade: 🟢 MUITO BAIXA
Importância: ⭐⭐ (diagnóstico)

🎯 MINHA RECOMENDAÇÃO:
ORDEM SUGERIDA:
1º → PATIENTS      (fundamental + simples)
2º → PROFESSIONALS (fundamental + simples)  
3º → SCHEDULES     (fundamental + médio)
4º → NOTIFICATIONS (importante + médio)
5º → TISS          (CRÍTICO mas complexo)
6º → SYNC          (útil)
7º → CHATWOOT      (útil)
8º → HEALTH        (trivial)