import { getFirestore, collection, query, where, getDocs, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export function initializeRelatorios(db, userId, common) {
    if (!userId) return;

    const { formatCurrency, toCents, fromCents, showFeedback } = common;

    // DOM Elements
    const relatorioTipoSelect = document.getElementById('relatorio-receber-tipo');
    const gerarRelatorioBtn = document.getElementById('gerar-relatorio-btn');
    const exportarRelatorioBtn = document.getElementById('exportar-relatorio-btn');
    const visualizacaoArea = document.getElementById('relatorio-visualizacao-area');
    const periodoDeInput = document.getElementById('relatorio-receber-periodo-de');
    const periodoAteInput = document.getElementById('relatorio-receber-periodo-ate');
    const clienteSelect = document.getElementById('relatorio-receber-cliente');
    const statusSelect = document.getElementById('relatorio-receber-status');
    const tituloRelatorioEl = document.querySelector('#relatorio-contas-a-receber-tab h2');

    let relatorioDadosBase = [];
    let clientesCache = [];

    // --- Utils para População de Dropdown ---
    async function populateClientesDropdown() {
        try {
            const clientesRef = collection(db, `users/${userId}/clientes`);
            const snapshot = await getDocs(clientesRef);
            clientesCache = snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome || doc.data().razaoSocial }));

            clienteSelect.innerHTML = '<option value="todos">Todos os Clientes</option>';
            clientesCache.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = cliente.nome;
                clienteSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar clientes para o relatório:", error);
        }
    }

    // --- Funções de Lógica de Relatório ---

    function processarRelatorio(tipo, filtros) {
        // Lógica de processamento de dados conforme o tipo de relatório selecionado
        switch (tipo) {
            case 'posicao-carteira':
                visualizacaoArea.innerHTML = renderPosicaoCarteira(relatorioDadosBase, filtros);
                break;
            case 'inadimplencia':
                visualizacaoArea.innerHTML = '<h3>Análise de Inadimplência</h3><p>Funcionalidade em construção.</p>';
                break;
            // ... (outros relatórios)
            default:
                visualizacaoArea.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione os filtros e clique em "Gerar Relatório".</p>`;
        }

        exportarRelatorioBtn.disabled = relatorioDadosBase.length === 0;
        tituloRelatorioEl.textContent = `Relatório: ${relatorioTipoSelect.options[relatorioTipoSelect.selectedIndex].textContent}`;
    }

    function renderPosicaoCarteira(dados, filtros) {
        let html = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Original</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Pendente</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">`;

        if (dados.length === 0) {
            html += `<tr><td colspan="6" class="text-center p-8 text-gray-500">Nenhum título encontrado para os filtros.</td></tr>`;
        } else {
            dados.forEach(d => {
                const statusClasses = { 'Recebido': 'bg-green-100 text-green-800', 'Vencido': 'bg-red-100 text-red-800', 'Pendente': 'bg-blue-100 text-blue-800', 'Recebido Parcialmente': 'bg-yellow-100 text-yellow-800' };
                const statusText = d.status || 'Pendente';
                const statusClass = statusClasses[statusText] || 'bg-gray-100 text-gray-800';

                html += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${d.clienteNome}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${d.descricao}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${new Date(d.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${formatCurrency(d.valorOriginal)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">${formatCurrency(d.saldoPendente)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-center">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                                ${statusText}
                            </span>
                        </td>
                    </tr>`;
            });
        }

        html += `</tbody></table></div>`;
        return html;
    }

    // --- Event Handlers ---

    gerarRelatorioBtn.addEventListener('click', async () => {
        gerarRelatorioBtn.disabled = true;
        gerarRelatorioBtn.innerHTML = '<span class="material-symbols-outlined text-base mr-2 animate-spin">refresh</span> Gerando...';
        visualizacaoArea.innerHTML = `<p class="text-center text-gray-500 py-12"><span class="material-symbols-outlined text-2xl animate-spin">sync</span> Carregando dados...</p>`;

        const filtros = {
            periodoDe: periodoDeInput.value,
            periodoAte: periodoAteInput.value,
            clienteId: clienteSelect.value,
            status: statusSelect.value,
            tipo: relatorioTipoSelect.value
        };

        try {
            // Monta a query
            let q = collection(db, `users/${userId}/receitas`);
            let queryConstraints = [];

            if (filtros.periodoDe) {
                queryConstraints.push(where("dataVencimento", ">=", filtros.periodoDe));
            }
            if (filtros.periodoAte) {
                queryConstraints.push(where("dataVencimento", "<=", filtros.periodosAte));
            }
            if (filtros.clienteId !== 'todos') {
                queryConstraints.push(where("clienteId", "==", filtros.clienteId));
            }
            if (filtros.status !== 'todos') {
                queryConstraints.push(where("status", "==", filtros.status));
            }
            queryConstraints.push(orderBy("dataVencimento", "asc"));

            q = query(q, ...queryConstraints);
            const snapshot = await getDocs(q);

            relatorioDadosBase = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(d => d.status !== 'Desdobrado'); // Ignora títulos desdobrados

            processarRelatorio(filtros.tipo, filtros);

        } catch (error) {
            console.error("Erro ao gerar relatório:", error);
            visualizacaoArea.innerHTML = `<p class="text-center text-red-500 py-12">Erro ao carregar o relatório: ${error.message}</p>`;
        } finally {
            gerarRelatorioBtn.disabled = false;
            gerarRelatorioBtn.innerHTML = '<span class="material-symbols-outlined text-base mr-2">analytics</span> Gerar Relatório';
        }
    });

    relatorioTipoSelect.addEventListener('change', () => {
        // Reinicia a visualização e os dados ao trocar o tipo de relatório
        if (relatorioDadosBase.length > 0) {
            processarRelatorio(relatorioTipoSelect.value, { periodoDe: periodoDeInput.value, periodoAte: periodoAteInput.value, clienteId: clienteSelect.value, status: statusSelect.value, tipo: relatorioTipoSelect.value });
        } else {
             tituloRelatorioEl.textContent = `Relatório: ${relatorioTipoSelect.options[relatorioTipoSelect.selectedIndex].textContent}`;
             visualizacaoArea.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione os filtros e clique em "Gerar Relatório".</p>`;
             exportarRelatorioBtn.disabled = true;
        }
    });

    // Exportação (Mock inicial, a lógica de exportação real será implementada posteriormente)
    exportarRelatorioBtn.addEventListener('click', () => {
         alert('Funcionalidade de exportação em desenvolvimento. Os dados seriam convertidos em CSV/XLSX.');
    });

    // Setup das abas (Contas a Receber / Contas a Pagar)
    const relatorioTabLinks = document.querySelectorAll('.relatorio-tab-link');
    const relatorioTabContents = document.querySelectorAll('.relatorio-tab-content');

    relatorioTabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            relatorioTabLinks.forEach(item => item.classList.remove('active'));
            link.classList.add('active');
            const tabId = link.dataset.relatorioTab;
            relatorioTabContents.forEach(content => {
                content.classList.toggle('hidden', content.id !== `relatorio-${tabId}-tab`);
            });
        });
    });

    // Chamadas iniciais
    populateClientesDropdown();
}