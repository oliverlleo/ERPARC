# Rollout seguro da autenticação e das regras do Firestore

Este PR troca os usuários vinculados às empresas de uma autenticação legada, baseada em senha armazenada no Firestore, para Firebase Authentication. Os dados antigos são migrados e a senha legada é removida somente quando a criação/vinculação do usuário no Firebase Auth termina com sucesso.

A ordem abaixo deve ser respeitada para não interromper os usuários existentes.

## 1. Não publique as novas regras primeiro

Não faça `firebase deploy --only firestore:rules` antes da migração dos acessos legados. As regras novas bloqueiam a leitura pública da coleção `acessos`, como medida de segurança.

## 2. Execute a versão deste PR em preview/local contra o Firebase atual

Abra esta branch em um ambiente de preview ou servidor local, mantendo o sistema de produção atual disponível aos usuários.

Entre como cada administrador Firebase que possua acessos de empresa. Ao autenticar o administrador, a aplicação executa `migrateLegacyCompanyAccesses` antes de inicializar o workspace.

Para cada acesso legado migrado com sucesso, o processo:

- cria ou recupera a identidade correspondente no Firebase Authentication;
- grava `authUid` e `authEmail` no documento de acesso;
- cria/atualiza `accessProfiles/{uid}`;
- cria/atualiza o documento determinístico em `loginDirectory`;
- remove o campo `senha` do Firestore somente no fim da migração daquele acesso.

A migração é repetível. Se ela for interrompida, o próximo login do administrador tenta novamente os acessos que ainda não terminaram.

## 3. Pare se aparecer alerta de falha de migração

Se a aplicação informar que um ou mais acessos não puderam ser migrados, não publique as novas regras ainda.

Resolva o acesso indicado e entre novamente como administrador até a migração terminar sem falhas. O código detecta colisão de login dentro da mesma empresa e não sobrescreve silenciosamente outro usuário.

## 4. Teste o login de empresa ainda no preview

Antes do corte, valide pelo menos:

- login de administrador;
- login de usuário de empresa com a senha atual;
- primeiro acesso/troca de senha;
- logout e novo login;
- acesso aos dados da própria empresa;
- criação de um novo acesso e login com a senha temporária;
- edição do nome de login;
- exclusão/desativação de um acesso.

## 5. Publique o frontend

Somente depois de todos os acessos legados estarem migrados e o login de empresa ter sido validado no preview, publique a nova versão do frontend.

## 6. Publique as regras do Firestore

Depois do frontend novo estar ativo e os acessos migrados, publique as regras:

```bash
firebase deploy --only firestore:rules
```

As regras deste PR foram compiladas com o emulador oficial do Firestore durante a validação do PR.

## 7. Faça o smoke test pós-corte

Após publicar as regras, repita rapidamente os testes de login de administrador e usuário de empresa, além de leitura e gravação de um lançamento financeiro.

## Observações de compatibilidade

- O nome de login continua respeitando exatamente maiúsculas, minúsculas e caracteres já usados pelo sistema antigo; a migração não muda silenciosamente essa regra.
- A lista de empresas continua disponível na tela de login para preservar o fluxo visual existente.
- Uma identidade Firebase de um acesso excluído pode continuar existindo no Firebase Authentication, porque o frontend não possui privilégio administrativo para apagar outra identidade. O vínculo, perfil e diretório são removidos; sem `accessProfiles` válido, as regras negam acesso aos dados e a aplicação encerra a sessão.
- O PR não deve ser colocado em produção pulando a etapa de migração em preview/local.
