import { getFirestore, collection, query, where, getDocs, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export function initializeRelatorios(db, userId, common) {
    if (!userId) return;

    const { formatCurrency, toCents, fromCents, showFeedback } = common;

    // DOM Elements - Contas a Receber
    const relatorioTipoSelect = document.getElementById('relatorio-receber-tipo');
    const gerarRelatorioBtn = document.getElementById('gerar-relatorio-btn');
    const exportarRelatorioBtn = document.getElementById('exportar-relatorio-btn');
    const visualizacaoArea = document.getElementById('relatorio-visualizacao-area');
    const periodoDeInput = document.getElementById('relatorio-receber-periodo-de');
    const periodoAteInput = document.getElementById('relatorio-receber-periodo-ate');
    const clienteSelect = document.getElementById('relatorio-receber-cliente');
    const statusSelect = document.getElementById('relatorio-receber-status');
    const tituloRelatorioReceberEl = document.querySelector('#relatorio-contas-a-receber-tab h2');

    // DOM Elements - Contas a Pagar
    const relatorioPagarTipoSelect = document.getElementById('relatorio-pagar-tipo');
    const gerarRelatorioPagarBtn = document.getElementById('gerar-relatorio-pagar-btn');
    const exportarRelatorioPagarBtn = document.getElementById('exportar-relatorio-pagar-btn');
    const visualizacaoPagarArea = document.getElementById('relatorio-pagar-visualizacao-area');
    const periodoPagarDeInput = document.getElementById('relatorio-pagar-periodo-de');
    const periodoPagarAteInput = document.getElementById('relatorio-pagar-periodo-ate');
    const fornecedorSelect = document.getElementById('relatorio-pagar-fornecedor');
    const statusPagarSelect = document.getElementById('relatorio-pagar-status');
    const tituloRelatorioPagarEl = document.querySelector('#relatorio-contas-a-pagar-tab h2');

    let relatorioDadosBase = [];
    let relatorioPagarDadosBase = [];
    let clientesCache = [];
    let fornecedoresCache = [];

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

    async function populateFornecedoresDropdown() {
        try {
            const fornecedoresRef = collection(db, `users/${userId}/fornecedores`);
            const snapshot = await getDocs(fornecedoresRef);
            fornecedoresCache = snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome || doc.data().razaoSocial }));

            fornecedorSelect.innerHTML = '<option value="todos">Todos os Fornecedores</option>';
            fornecedoresCache.forEach(fornecedor => {
                const option = document.createElement('option');
                option.value = fornecedor.id;
                option.textContent = fornecedor.nome;
                fornecedorSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar fornecedores para o relatório:", error);
        }
    }

    // --- Funções de Lógica de Relatório ---

    function processarRelatorio(tipo, filtros) {
        let dadosParaRenderizar;

        // Client-side filtering based on the report type
        switch (tipo) {
            case 'posicao-carteira':
                dadosParaRenderizar = (filtros.status === 'todos')
                    ? relatorioDadosBase
                    : relatorioDadosBase.filter(d => d.status === filtros.status);
                visualizacaoArea.innerHTML = renderPosicaoCarteira(dadosParaRenderizar, filtros);
                break;
            case 'inadimplencia':
                // Pass all non-paid items to the function, it will filter by date.
                dadosParaRenderizar = relatorioDadosBase.filter(d => d.status === 'Pendente' || d.status === 'Vencido' || d.status === 'Recebido Parcialmente');
                visualizacaoArea.innerHTML = renderInadimplencia(dadosParaRenderizar);
                break;
            case 'previsao':
                dadosParaRenderizar = relatorioDadosBase.filter(d => d.status === 'Pendente' || d.status === 'Recebido Parcialmente');
                visualizacaoArea.innerHTML = renderPrevisaoRecebimentos(dadosParaRenderizar);
                break;
            case 'categoria':
                dadosParaRenderizar = relatorioDadosBase; // All data, will be grouped inside
                visualizacaoArea.innerHTML = renderAnaliseCategoria(dadosParaRenderizar);
                break;
            default:
                visualizacaoArea.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione um tipo de relatório e clique em "Gerar Relatório".</p>`;
                exportarRelatorioBtn.disabled = true;
                return;
        }

        exportarRelatorioBtn.disabled = dadosParaRenderizar.length === 0;
        tituloRelatorioReceberEl.textContent = `Relatório: ${relatorioTipoSelect.options[relatorioTipoSelect.selectedIndex].textContent}`;
    }

    function processarRelatorioPagar(tipo, filtros) {
        let dadosParaRenderizar;

        switch (tipo) {
            case 'posicao-pagar':
                dadosParaRenderizar = (filtros.status === 'todos')
                    ? relatorioPagarDadosBase
                    : relatorioPagarDadosBase.filter(d => d.status === filtros.status);
                visualizacaoPagarArea.innerHTML = renderPosicaoPagar(dadosParaRenderizar, filtros);
                break;
            case 'analise-atraso':
                dadosParaRenderizar = relatorioPagarDadosBase.filter(d => d.status === 'Pendente' || d.status === 'Vencido' || d.status === 'Pago Parcialmente');
                visualizacaoPagarArea.innerHTML = renderAnaliseAtraso(dadosParaRenderizar);
                break;
            case 'previsao-pagar':
                dadosParaRenderizar = relatorioPagarDadosBase.filter(d => d.status === 'Pendente' || d.status === 'Pago Parcialmente');
                visualizacaoPagarArea.innerHTML = renderPrevisaoPagar(dadosParaRenderizar);
                break;
            case 'analise-despesas':
                dadosParaRenderizar = relatorioPagarDadosBase;
                visualizacaoPagarArea.innerHTML = renderAnaliseDespesas(dadosParaRenderizar);
                break;
            default:
                visualizacaoPagarArea.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione um tipo de relatório e clique em "Gerar Relatório".</p>`;
                exportarRelatorioPagarBtn.disabled = true;
                return;
        }

        exportarRelatorioPagarBtn.disabled = dadosParaRenderizar.length === 0;
        tituloRelatorioPagarEl.textContent = `Relatório: ${relatorioPagarTipoSelect.options[relatorioPagarTipoSelect.selectedIndex].textContent}`;
    }

    function renderPosicaoPagar(dados, filtros) {
        let html = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Original</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Devedor</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">`;

        if (dados.length === 0) {
            html += `<tr><td colspan="6" class="text-center p-8 text-gray-500">Nenhum título encontrado para os filtros.</td></tr>`;
        } else {
            dados.forEach(d => {
                const statusClasses = { 'Pago': 'bg-green-100 text-green-800', 'Vencido': 'bg-red-100 text-red-800', 'Pendente': 'bg-blue-100 text-blue-800', 'Pago Parcialmente': 'bg-yellow-100 text-yellow-800' };
                const statusText = d.status || 'Pendente';
                const statusClass = statusClasses[statusText] || 'bg-gray-100 text-gray-800';

                html += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${d.fornecedorNome}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${d.descricao}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${new Date(d.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${formatCurrency(d.valor)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">${formatCurrency(d.saldo)}</td>
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

    function renderAnaliseAtraso(dados) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const dadosComAtraso = dados
            .filter(d => {
                const dataVencimento = new Date(d.dataVencimento + 'T00:00:00');
                return dataVencimento < hoje && (d.status === 'Pendente' || d.status === 'Vencido' || d.status === 'Pago Parcialmente');
            })
            .map(d => {
                const dataVencimento = new Date(d.dataVencimento + 'T00:00:00');
                const diffTime = Math.abs(hoje - dataVencimento);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return { ...d, diasAtraso: diffDays };
            });

        if (dadosComAtraso.length === 0) {
            return `<p class="text-center text-gray-500 py-12">Nenhum título vencido encontrado para os filtros selecionados.</p>`;
        }

        const buckets = {
            '30': { total: 0, items: [] },
            '60': { total: 0, items: [] },
            '90': { total: 0, items: [] },
            '91+': { total: 0, items: [] }
        };

        dadosComAtraso.forEach(d => {
            const saldo = d.saldo || 0;
            if (d.diasAtraso <= 30) {
                buckets['30'].items.push(d);
                buckets['30'].total += saldo;
            } else if (d.diasAtraso <= 60) {
                buckets['60'].items.push(d);
                buckets['60'].total += saldo;
            } else if (d.diasAtraso <= 90) {
                buckets['90'].items.push(d);
                buckets['90'].total += saldo;
            } else {
                buckets['91+'].items.push(d);
                buckets['91+'].total += saldo;
            }
        });

        let html = '';
        const grandTotal = Object.values(buckets).reduce((acc, bucket) => acc + bucket.total, 0);

        const renderBucket = (title, bucket) => {
            if (bucket.items.length === 0) return '';
            let bucketHtml = `
                <div class="mb-8">
                    <div class="flex justify-between items-center bg-gray-100 p-3 rounded-t-lg border-b">
                        <h4 class="text-lg font-semibold text-gray-800">${title}</h4>
                        <span class="font-bold text-lg text-red-600">${formatCurrency(bucket.total)}</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Dias em Atraso</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Saldo Devedor</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">`;

            bucket.items.sort((a, b) => b.diasAtraso - a.diasAtraso).forEach(d => {
                bucketHtml += `
                    <tr>
                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">${d.fornecedorNome}</td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">${new Date(d.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center font-semibold text-red-700">${d.diasAtraso}</td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm text-right font-medium">${formatCurrency(d.saldo)}</td>
                    </tr>`;
            });

            bucketHtml += `</tbody></table></div></div>`;
            return bucketHtml;
        };

        html += renderBucket('Vencidos até 30 dias', buckets['30']);
        html += renderBucket('Vencidos de 31 a 60 dias', buckets['60']);
        html += renderBucket('Vencidos de 61 a 90 dias', buckets['90']);
        html += renderBucket('Vencidos há mais de 90 dias', buckets['91+']);

        html += `
            <div class="mt-8 pt-4 border-t-2 border-gray-300 flex justify-end items-center">
                <h3 class="text-xl font-bold text-gray-900">Total Geral Vencido:</h3>
                <span class="text-xl font-bold text-red-700 ml-4">${formatCurrency(grandTotal)}</span>
            </div>`;

        return html;
    }

    function renderPrevisaoPagar(dados) {
        const hoje = new Date();
        const previsoes = {}; // Ex: { '2023-10': 150000, '2023-11': 200000 }

        dados.forEach(d => {
            const dataVencimento = new Date(d.dataVencimento + 'T00:00:00');
            if (dataVencimento >= hoje) {
                const mesAno = `${dataVencimento.getFullYear()}-${String(dataVencimento.getMonth() + 1).padStart(2, '0')}`;
                if (!previsoes[mesAno]) {
                    previsoes[mesAno] = 0;
                }
                previsoes[mesAno] += d.saldo || 0;
            }
        });

        if (Object.keys(previsoes).length === 0) {
            return `<p class="text-center text-gray-500 py-12">Nenhuma despesa futura encontrada.</p>`;
        }

        let html = `
            <div class="space-y-4">
                <h3 class="text-lg font-semibold">Previsão Mensal de Desembolsos</h3>`;

        const mesesOrdenados = Object.keys(previsoes).sort();

        mesesOrdenados.forEach(mesAno => {
            const [ano, mes] = mesAno.split('-');
            const nomeMes = new Date(ano, mes - 1, 1).toLocaleString('pt-BR', { month: 'long' });
            html += `
                <div class="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                    <span class="font-medium text-blue-800">${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} de ${ano}</span>
                    <span class="font-bold text-xl text-blue-900">${formatCurrency(previsoes[mesAno])}</span>
                </div>`;
        });

        html += `</div>`;
        return html;
    }

    function renderAnaliseDespesas(dados) {
        if (dados.length === 0) {
            return `<p class="text-center text-gray-500 py-12">Nenhum dado encontrado para analisar por categoria.</p>`;
        }

        const categorias = {};
        dados.forEach(d => {
            const categoriaId = d.categoriaId || 'sem-categoria';
            const categoriaNome = d.categoriaNome || 'Sem Categoria';
            if (!categorias[categoriaId]) {
                categorias[categoriaId] = { nome: categoriaNome, total: 0, pago: 0, aPagar: 0 };
            }
            categorias[categoriaId].total += d.valor || 0;
            categorias[categoriaId].pago += d.valorPago || 0;
            categorias[categoriaId].aPagar += d.saldo || 0;
        });

        let html = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Pago</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">A Pagar</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">`;

        for (const id in categorias) {
            const cat = categorias[id];
            html += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">${cat.nome}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${formatCurrency(cat.total)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">${formatCurrency(cat.pago)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600">${formatCurrency(cat.aPagar)}</td>
                </tr>
            `;
        }

        html += `</tbody></table></div>`;
        return html;
    }

    function renderInadimplencia(dados) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const dadosComAtraso = dados
            .filter(d => {
                const dataVencimento = new Date(d.dataVencimento + 'T00:00:00');
                return dataVencimento < hoje && (d.status === 'Pendente' || d.status === 'Vencido' || d.status === 'Recebido Parcialmente');
            })
            .map(d => {
                const dataVencimento = new Date(d.dataVencimento + 'T00:00:00');
                const diffTime = Math.abs(hoje - dataVencimento);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return { ...d, diasAtraso: diffDays };
            });

        if (dadosComAtraso.length === 0) {
            return `<p class="text-center text-gray-500 py-12">Nenhum título vencido encontrado para os filtros selecionados.</p>`;
        }

        const buckets = {
            '30': { total: 0, items: [] },
            '60': { total: 0, items: [] },
            '90': { total: 0, items: [] },
            '91+': { total: 0, items: [] }
        };

        dadosComAtraso.forEach(d => {
            const saldo = d.saldoPendente || 0;
            if (d.diasAtraso <= 30) {
                buckets['30'].items.push(d);
                buckets['30'].total += saldo;
            } else if (d.diasAtraso <= 60) {
                buckets['60'].items.push(d);
                buckets['60'].total += saldo;
            } else if (d.diasAtraso <= 90) {
                buckets['90'].items.push(d);
                buckets['90'].total += saldo;
            } else {
                buckets['91+'].items.push(d);
                buckets['91+'].total += saldo;
            }
        });

        let html = '';
        const grandTotal = Object.values(buckets).reduce((acc, bucket) => acc + bucket.total, 0);

        const renderBucket = (title, bucket) => {
            if (bucket.items.length === 0) return '';
            let bucketHtml = `
                <div class="mb-8">
                    <div class="flex justify-between items-center bg-gray-100 p-3 rounded-t-lg border-b">
                        <h4 class="text-lg font-semibold text-gray-800">${title}</h4>
                        <span class="font-bold text-lg text-red-600">${formatCurrency(bucket.total)}</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                                    <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Dias em Atraso</th>
                                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Saldo Pendente</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">`;

            bucket.items.sort((a, b) => b.diasAtraso - a.diasAtraso).forEach(d => {
                bucketHtml += `
                    <tr>
                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">${d.clienteNome}</td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700">${new Date(d.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm text-center font-semibold text-red-700">${d.diasAtraso}</td>
                        <td class="px-4 py-2 whitespace-nowrap text-sm text-right font-medium">${formatCurrency(d.saldoPendente)}</td>
                    </tr>`;
            });

            bucketHtml += `</tbody></table></div></div>`;
            return bucketHtml;
        };

        html += renderBucket('Vencidos até 30 dias', buckets['30']);
        html += renderBucket('Vencidos de 31 a 60 dias', buckets['60']);
        html += renderBucket('Vencidos de 61 a 90 dias', buckets['90']);
        html += renderBucket('Vencidos há mais de 90 dias', buckets['91+']);

        html += `
            <div class="mt-8 pt-4 border-t-2 border-gray-300 flex justify-end items-center">
                <h3 class="text-xl font-bold text-gray-900">Total Geral Vencido:</h3>
                <span class="text-xl font-bold text-red-700 ml-4">${formatCurrency(grandTotal)}</span>
            </div>`;

        return html;
    }

    function renderAnaliseCategoria(dados) {
        if (dados.length === 0) {
            return `<p class="text-center text-gray-500 py-12">Nenhum dado encontrado para analisar por categoria.</p>`;
        }

        const categorias = {};
        dados.forEach(d => {
            const categoriaId = d.categoriaId || 'sem-categoria';
            const categoriaNome = d.categoriaNome || 'Sem Categoria'; // Assume you might add categoriaNome later
            if (!categorias[categoriaId]) {
                categorias[categoriaId] = { nome: categoriaNome, total: 0, recebido: 0, aReceber: 0 };
            }
            categorias[categoriaId].total += d.valorOriginal || 0;
            categorias[categoriaId].recebido += d.totalRecebido || 0;
            categorias[categoriaId].aReceber += d.saldoPendente || 0;
        });

        let html = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Recebido</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">A Receber</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">`;

        for (const id in categorias) {
            const cat = categorias[id];
            html += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">${cat.nome}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${formatCurrency(cat.total)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">${formatCurrency(cat.recebido)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600">${formatCurrency(cat.aReceber)}</td>
                </tr>
            `;
        }

        html += `</tbody></table></div>`;
        return html;
    }

    function renderPrevisaoRecebimentos(dados) {
        const hoje = new Date();
        const previsoes = {}; // Ex: { '2023-10': 150000, '2023-11': 200000 }

        dados.forEach(d => {
            const dataVencimento = new Date(d.dataVencimento + 'T00:00:00');
            if (dataVencimento >= hoje) {
                const mesAno = `${dataVencimento.getFullYear()}-${String(dataVencimento.getMonth() + 1).padStart(2, '0')}`;
                if (!previsoes[mesAno]) {
                    previsoes[mesAno] = 0;
                }
                previsoes[mesAno] += d.saldoPendente || 0;
            }
        });

        if (Object.keys(previsoes).length === 0) {
            return `<p class="text-center text-gray-500 py-12">Nenhum recebimento futuro encontrado.</p>`;
        }

        let html = `
            <div class="space-y-4">
                <h3 class="text-lg font-semibold">Previsão Mensal de Recebimentos</h3>`;

        const mesesOrdenados = Object.keys(previsoes).sort();

        mesesOrdenados.forEach(mesAno => {
            const [ano, mes] = mesAno.split('-');
            const nomeMes = new Date(ano, mes - 1, 1).toLocaleString('pt-BR', { month: 'long' });
            html += `
                <div class="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                    <span class="font-medium text-blue-800">${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} de ${ano}</span>
                    <span class="font-bold text-xl text-blue-900">${formatCurrency(previsoes[mesAno])}</span>
                </div>`;
        });

        html += `</div>`;
        return html;
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
            // Build a simpler, more robust base query
            let q = collection(db, `users/${userId}/receitas`);
            let queryConstraints = [];

            if (filtros.periodoDe) {
                queryConstraints.push(where("dataVencimento", ">=", filtros.periodoDe));
            }
            if (filtros.periodoAte) {
                queryConstraints.push(where("dataVencimento", "<=", filtros.periodoAte));
            }

            // IMPORTANT: No status or client filter here. It will be done on the client to avoid complex query issues.
            queryConstraints.push(orderBy("dataVencimento", "asc"));

            q = query(q, ...queryConstraints);
            const snapshot = await getDocs(q);

            // Filter client and status on the client side
            relatorioDadosBase = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(d => {
                    const clienteMatch = filtros.clienteId === 'todos' || d.clienteId === filtros.clienteId;
                    const statusMatch = d.status !== 'Desdobrado';
                    return clienteMatch && statusMatch;
                });

            processarRelatorio(filtros.tipo, filtros);

        } catch (error) {
            console.error("Erro ao gerar relatório:", error);
            visualizacaoArea.innerHTML = `<p class="text-center text-red-500 py-12">Erro ao carregar o relatório: ${error.message}</p>`;
        } finally {
            gerarRelatorioBtn.disabled = false;
            gerarRelatorioBtn.innerHTML = '<span class="material-symbols-outlined text-base mr-2">analytics</span> Gerar Relatório';
        }
    });

    function toggleReportFilters(type = 'receber') {
        if (type === 'receber') {
            const selectedType = relatorioTipoSelect.value;
            const statusFilterContainer = statusSelect.parentElement;
            statusFilterContainer.classList.toggle('hidden', selectedType === 'inadimplencia');
        } else { // 'pagar'
            const selectedType = relatorioPagarTipoSelect.value;
            const statusFilterContainer = statusPagarSelect.parentElement;
            statusFilterContainer.classList.toggle('hidden', selectedType === 'analise-atraso');
        }
    }

    relatorioTipoSelect.addEventListener('change', () => {
        toggleReportFilters('receber');
        if (relatorioDadosBase.length > 0) {
            processarRelatorio(relatorioTipoSelect.value, {
                periodoDe: periodoDeInput.value,
                periodoAte: periodoAteInput.value,
                clienteId: clienteSelect.value,
                status: statusSelect.value,
                tipo: relatorioTipoSelect.value
            });
        } else {
             tituloRelatorioReceberEl.textContent = `Relatório: ${relatorioTipoSelect.options[relatorioTipoSelect.selectedIndex].textContent}`;
             visualizacaoArea.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione os filtros e clique em "Gerar Relatório".</p>`;
             exportarRelatorioBtn.disabled = true;
        }
    });

    relatorioPagarTipoSelect.addEventListener('change', () => {
        toggleReportFilters('pagar');
        if (relatorioPagarDadosBase.length > 0) {
            processarRelatorioPagar(relatorioPagarTipoSelect.value, {
                periodoDe: periodoPagarDeInput.value,
                periodoAte: periodoPagarAteInput.value,
                fornecedorId: fornecedorSelect.value,
                status: statusPagarSelect.value,
                tipo: relatorioPagarTipoSelect.value
            });
        } else {
            tituloRelatorioPagarEl.textContent = `Relatório: ${relatorioPagarTipoSelect.options[relatorioPagarTipoSelect.selectedIndex].textContent}`;
            visualizacaoPagarArea.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione os filtros e clique em "Gerar Relatório".</p>`;
            exportarRelatorioPagarBtn.disabled = true;
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

    gerarRelatorioPagarBtn.addEventListener('click', async () => {
        gerarRelatorioPagarBtn.disabled = true;
        gerarRelatorioPagarBtn.innerHTML = '<span class="material-symbols-outlined text-base mr-2 animate-spin">refresh</span> Gerando...';
        visualizacaoPagarArea.innerHTML = `<p class="text-center text-gray-500 py-12"><span class="material-symbols-outlined text-2xl animate-spin">sync</span> Carregando dados...</p>`;

        const filtros = {
            periodoDe: periodoPagarDeInput.value,
            periodoAte: periodoPagarAteInput.value,
            fornecedorId: fornecedorSelect.value,
            status: statusPagarSelect.value,
            tipo: relatorioPagarTipoSelect.value
        };

        try {
            let q = collection(db, `users/${userId}/despesas`);
            let queryConstraints = [];

            if (filtros.periodoDe) {
                queryConstraints.push(where("dataVencimento", ">=", filtros.periodoDe));
            }
            if (filtros.periodoAte) {
                queryConstraints.push(where("dataVencimento", "<=", filtros.periodoAte));
            }
            queryConstraints.push(orderBy("dataVencimento", "asc"));

            q = query(q, ...queryConstraints);
            const snapshot = await getDocs(q);

            relatorioPagarDadosBase = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(d => {
                    const fornecedorMatch = filtros.fornecedorId === 'todos' || d.fornecedorId === filtros.fornecedorId;
                    return fornecedorMatch;
                });

            processarRelatorioPagar(filtros.tipo, filtros);

        } catch (error) {
            console.error("Erro ao gerar relatório de contas a pagar:", error);
            visualizacaoPagarArea.innerHTML = `<p class="text-center text-red-500 py-12">Erro ao carregar o relatório: ${error.message}</p>`;
        } finally {
            gerarRelatorioPagarBtn.disabled = false;
            gerarRelatorioPagarBtn.innerHTML = '<span class="material-symbols-outlined text-base mr-2">analytics</span> Gerar Relatório';
        }
    });

    // Chamadas iniciais
    populateClientesDropdown();
    populateFornecedoresDropdown();
    toggleReportFilters('receber');
    toggleReportFilters('pagar');
}