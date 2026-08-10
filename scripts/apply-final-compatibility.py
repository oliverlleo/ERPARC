from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)


# Preserve legacy username semantics exactly and make synthetic Firebase emails
# case-collision-proof even though Firebase treats email addresses case-insensitively.
path = Path('auth-company.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "    return String(login ?? '').normalize('NFKC').trim().toLowerCase();",
    "    return String(login ?? '');",
    'preserve legacy login case/spacing'
)
text = replace_once(
    text,
    "function authEmailForAccess(accessId) {\n    return `${accessId}@${COMPANY_AUTH_DOMAIN}`;\n}",
    "function accessIdToken(accessId) {\n    return Array.from(String(accessId), char => char.codePointAt(0).toString(16).padStart(2, '0')).join('');\n}\n\nfunction authEmailForAccess(accessId) {\n    return `u${accessIdToken(accessId)}@${COMPANY_AUTH_DOMAIN}`;\n}",
    'case-safe synthetic auth email'
)
text = replace_once(
    text,
    "            failures.push({ accessId: accessDoc.id, message: error?.message || String(error) });",
    "            failures.push({ accessId: accessDoc.id, login: data.login, message: error?.message || String(error) });",
    'migration failure context'
)
path.write_text(text, encoding='utf-8')

# Surface migration conflicts instead of silently leaving a company account
# unable to use the new Firebase Auth login after rollout.
path = Path('index.html')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "            if (migration.failures.length > 0) {\n                console.error('Alguns acessos legados não puderam ser migrados:', migration.failures);\n            }",
    "            if (migration.failures.length > 0) {\n                console.error('Alguns acessos legados não puderam ser migrados:', migration.failures);\n                const failedLogins = migration.failures.map(item => item.login || item.accessId).join(', ');\n                alert(`ATENÇÃO: ${migration.failures.length} acesso(s) não puderam ser migrados para o Firebase Auth: ${failedLogins}. Os dados antigos foram preservados. Não publique as novas regras do Firestore até corrigir esses acessos e a migração terminar sem falhas.`);\n            }",
    'visible migration failure warning'
)
text = replace_once(
    text,
    "        } catch (error) {\n            console.error(`Erro ao salvar acesso:`, error);\n            showFeedback(feedbackId, \"Erro ao salvar acesso. Tente novamente.\", true);\n        }",
    "        } catch (error) {\n            console.error(`Erro ao salvar acesso:`, error);\n            const message = error?.code === 'company-auth/login-in-use'\n                ? error.message\n                : 'Erro ao salvar acesso. Tente novamente.';\n            showFeedback(feedbackId, message, true);\n        }",
    'duplicate login feedback'
)
path.write_text(text, encoding='utf-8')

print('Final compatibility patch applied successfully')
