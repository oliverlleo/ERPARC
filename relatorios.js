import { getFirestore, collection, query, where, getDocs, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export function initializeRelatorios(db, userId, common) {
    if (!userId) return;

    const { formatCurrency, toCents, fromCents, showFeedback } = common;

    // --- Elementos Comuns ---
    const relatorioTabLinks = document.querySelectorAll('.relatorio-tab-link');
    const relatorioTabContents = document.querySelectorAll('.relatorio-tab-content');

    // --- Elementos Contas a Receber ---
    const receberTipoSelect = document.getElementById('relatorio-receber-tipo');
    const gerarRelatorioReceberBtn = document.getElementById('gerar-relatorio-btn');
    const exportarRelatorioReceberBtn = document.getElementById('exportar-relatorio-btn');
    const visualizacaoAreaReceber = document.getElementById('relatorio-visualizacao-area');
    const receberPeriodoDeInput = document.getElementById('relatorio-receber-periodo-de');
    const receberPeriodoAteInput = document.getElementById('relatorio-receber-periodo-ate');
    const receberClienteSelect = document.getElementById('relatorio-receber-cliente');
    const receberStatusSelect = document.getElementById('relatorio-receber-status');
    const tituloRelatorioReceberEl = document.querySelector('#relatorio-contas-a-receber-tab h2');

    // --- Elementos Contas a Pagar ---
    const pagarTipoSelect = document.getElementById('relatorio-pagar-tipo');
    const gerarRelatorioPagarBtn = document.getElementById('gerar-relatorio-pagar-btn');
    const exportarRelatorioPagarBtn = document.getElementById('exportar-relatorio-pagar-btn');
    const visualizacaoAreaPagar = document.getElementById('relatorio-pagar-visualizacao-area');
    const pagarPeriodoDeInput = document.getElementById('relatorio-pagar-periodo-de');
    const pagarPeriodoAteInput = document.getElementById('relatorio-pagar-periodo-ate');
    const pagarBeneficiarioSelect = document.getElementById('relatorio-pagar-beneficiario');
    const pagarStatusSelect = document.getElementById('relatorio-pagar-status');
    const tituloRelatorioPagarEl = document.getElementById('relatorio-pagar-titulo');


    let relatorioDadosBase = []; // Cache para dados de Contas a Receber
    let relatorioDadosPagarBase = []; // Cache para dados de Contas a Pagar
    let clientesCache = [];
    let beneficiariosCache = [];


    // --- Utils para População de Dropdowns ---
    async function populateClientesDropdown() {
        try {
            const clientesRef = collection(db, `users/${userId}/clientes`);
            const snapshot = await getDocs(clientesRef);
            clientesCache = snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome || doc.data().razaoSocial }));

            receberClienteSelect.innerHTML = '<option value="todos">Todos os Clientes</option>';
            clientesCache.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = cliente.nome;
                receberClienteSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar clientes para o relatório:", error);
        }
    }

    async function populateBeneficiariosDropdown() {
        try {
            const fornecedoresRef = collection(db, `users/${userId}/fornecedores`);
            const funcionariosRef = collection(db, `users/${userId}/funcionarios`);
            const [fornecedoresSnap, funcionariosSnap] = await Promise.all([getDocs(fornecedoresRef), getDocs(funcionariosRef)]);

            const fornecedores = fornecedoresSnap.docs.map(doc => ({ id: doc.id, nome: doc.data().dadosPrincipais.nomeFantasia || doc.data().dadosPrincipais.razaoSocial, tipo: 'Fornecedor' }));
            const funcionarios = funcionariosSnap.docs.map(doc => ({ id: doc.id, nome: doc.data().pessoal.nomeCompleto, tipo: 'Funcionário' }));
            beneficiariosCache = [...fornecedores, ...funcionarios];

            pagarBeneficiarioSelect.innerHTML = '<option value="todos">Todos</option>';
            beneficiariosCache.forEach(ben => {
                const option = document.createElement('option');
                option.value = ben.id;
                option.textContent = `${ben.nome} (${ben.tipo})`;
                pagarBeneficiarioSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Erro ao carregar beneficiários:", error);
        }
    }


    // --- Funções de Lógica de Relatório (Contas a Receber) ---

    function processarRelatorioReceber(tipo, filtros) {
        let dadosParaRenderizar;

        switch (tipo) {
            case 'posicao-carteira':
                dadosParaRenderizar = (filtros.status === 'todos')
                    ? relatorioDadosBase
                    : relatorioDadosBase.filter(d => d.status === filtros.status);
                visualizacaoAreaReceber.innerHTML = renderPosicaoCarteira(dadosParaRenderizar);
                break;
            case 'inadimplencia':
                dadosParaRenderizar = relatorioDadosBase.filter(d => d.status === 'Pendente' || d.status === 'Vencido' || d.status === 'Recebido Parcialmente');
                visualizacaoAreaReceber.innerHTML = renderInadimplencia(dadosParaRenderizar);
                break;
            case 'previsao':
                dadosParaRenderizar = relatorioDadosBase.filter(d => d.status === 'Pendente' || d.status === 'Recebido Parcialmente');
                visualizacaoAreaReceber.innerHTML = renderPrevisaoRecebimentos(dadosParaRenderizar);
                break;
            case 'categoria':
                dadosParaRenderizar = relatorioDadosBase;
                visualizacaoAreaReceber.innerHTML = renderAnaliseCategoria(dadosParaRenderizar);
                break;
            default:
                visualizacaoAreaReceber.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione um tipo de relatório e clique em "Gerar Relatório".</p>`;
                exportarRelatorioReceberBtn.disabled = true;
                return;
        }

        exportarRelatorioReceberBtn.disabled = dadosParaRenderizar.length === 0;
        tituloRelatorioReceberEl.textContent = `Relatório: ${receberTipoSelect.options[receberTipoSelect.selectedIndex].textContent}`;
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

    function renderPosicaoCarteira(dados) {
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

    // --- Funções de Lógica de Relatório (Contas a Pagar) ---
    function processarRelatorioPagar(tipo, filtros) {
        let dadosParaRenderizar;

        // Client-side filtering
        let dadosFiltrados = relatorioDadosPagarBase.filter(d => {
            const beneficiarioMatch = filtros.beneficiarioId === 'todos' || d.favorecidoId === filtros.beneficiarioId;
            const statusMatch = filtros.status === 'todos' || d.status === filtros.status;
            return beneficiarioMatch && statusMatch;
        });

        switch (tipo) {
            case 'posicao-carteira-pagar':
                dadosParaRenderizar = dadosFiltrados;
                visualizacaoAreaPagar.innerHTML = renderPosicaoCarteiraPagar(dadosParaRenderizar);
                break;
            case 'analise-atraso':
                 dadosParaRenderizar = dadosFiltrados.filter(d => d.status === 'Pendente' || d.status === 'Vencido' || d.status === 'Pago Parcialmente');
                 visualizacaoAreaPagar.innerHTML = renderAnaliseAtraso(dadosParaRenderizar);
                break;
            case 'previsao-desembolsos':
                dadosParaRenderizar = dadosFiltrados.filter(d => d.status === 'Pendente' || d.status === 'Pago Parcialmente');
                visualizacaoAreaPagar.innerHTML = renderPrevisaoDesembolsos(dadosParaRenderizar);
                break;
            case 'analise-despesas':
                 dadosParaRenderizar = dadosFiltrados;
                 visualizacaoAreaPagar.innerHTML = renderAnaliseDespesas(dadosParaRenderizar);
                break;
            default:
                visualizacaoAreaPagar.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione um tipo de relatório e clique em "Gerar Relatório".</p>`;
                exportarRelatorioPagarBtn.disabled = true;
                return;
        }

        exportarRelatorioPagarBtn.disabled = dadosParaRenderizar.length === 0;
        tituloRelatorioPagarEl.textContent = `Relatório: ${pagarTipoSelect.options[pagarTipoSelect.selectedIndex].textContent}`;
    }

    function renderPosicaoCarteiraPagar(dados) {
        let html = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número Doc.</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Favorecido</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Original</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Devedor</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">`;

        if (dados.length === 0) {
            html += `<tr><td colspan="7" class="text-center p-8 text-gray-500">Nenhum título encontrado.</td></tr>`;
        } else {
            dados.forEach(d => {
                const statusClasses = { 'Pago': 'bg-green-100 text-green-800', 'Vencido': 'bg-red-100 text-red-800', 'Pendente': 'bg-blue-100 text-blue-800', 'Pago Parcialmente': 'bg-yellow-100 text-yellow-800' };
                const statusText = d.status || 'Pendente';
                const statusClass = statusClasses[statusText] || 'bg-gray-100 text-gray-800';

                html += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${d.numeroDocumento || 'N/A'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${d.descricao}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${d.favorecidoNome}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${new Date(d.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right">${formatCurrency(d.valorOriginal)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">${formatCurrency(d.valorSaldo)}</td>
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
                const dataVencimento = new Date(d.vencimento + 'T00:00:00');
                return dataVencimento < hoje && (d.status === 'Pendente' || d.status === 'Vencido' || d.status === 'Pago Parcialmente');
            })
            .map(d => {
                const dataVencimento = new Date(d.vencimento + 'T00:00:00');
                const diffTime = Math.abs(hoje - dataVencimento);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return { ...d, diasAtraso: diffDays };
            });

        if (dadosComAtraso.length === 0) {
            return `<p class="text-center text-gray-500 py-12">Nenhum título vencido encontrado.</p>`;
        }

        const buckets = {
            '30': { total: 0, items: [] },
            '60': { total: 0, items: [] },
            '90': { total: 0, items: [] },
            '91+': { total: 0, items: [] }
        };

        dadosComAtraso.forEach(d => {
            const saldo = d.valorSaldo || 0;
            if (d.diasAtraso <= 30) buckets['30'].total += saldo;
            else if (d.diasAtraso <= 60) buckets['60'].total += saldo;
            else if (d.diasAtraso <= 90) buckets['90'].total += saldo;
            else buckets['91+'].total += saldo;
        });

        let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">';
        const bucketData = [
            { label: 'Vencidos até 30 dias', key: '30', color: 'yellow' },
            { label: 'Vencidos de 31 a 60 dias', key: '60', color: 'orange' },
            { label: 'Vencidos de 61 a 90 dias', key: '90', color: 'red' },
            { label: 'Vencidos há mais de 90 dias', key: '91+', color: 'red' }
        ];

        bucketData.forEach(bucketInfo => {
            const total = buckets[bucketInfo.key].total;
            const colorClass = total > 0 ? `text-${bucketInfo.color}-600` : 'text-gray-700';
            html += `
                <div class="bg-white p-4 rounded-lg border shadow-sm">
                    <h4 class="text-gray-600 text-sm font-medium">${bucketInfo.label}</h4>
                    <p class="text-3xl font-bold ${colorClass} mt-2">${formatCurrency(total)}</p>
                </div>`;
        });
        html += '</div>';
        return html;
    }

    function renderPrevisaoDesembolsos(dados) {
        const previsoes = {};

        // A previsão deve incluir tudo que está em aberto (Pendente, Vencido, Pago Parcialmente),
        // independentemente se a data de vencimento já passou.
        dados.forEach(d => {
            const dataVencimento = new Date(d.vencimento + 'T00:00:00');
            const mesAno = `${dataVencimento.getFullYear()}-${String(dataVencimento.getMonth() + 1).padStart(2, '0')}`;

            if (!previsoes[mesAno]) {
                previsoes[mesAno] = 0;
            }
            previsoes[mesAno] += d.valorSaldo || 0;
        });

        if (Object.keys(previsoes).length === 0) {
            return `<p class="text-center text-gray-500 py-12">Nenhum desembolso futuro encontrado.</p>`;
        }

        let html = `<div class="space-y-4"><h3 class="text-lg font-semibold">Previsão Mensal de Desembolsos</h3>`;
        const mesesOrdenados = Object.keys(previsoes).sort();

        mesesOrdenados.forEach(mesAno => {
            const [ano, mes] = mesAno.split('-');
            const nomeMes = new Date(ano, mes - 1, 1).toLocaleString('pt-BR', { month: 'long' });
            html += `
                <div class="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                    <span class="font-medium text-red-800">${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} de ${ano}</span>
                    <span class="font-bold text-xl text-red-900">${formatCurrency(previsoes[mesAno])}</span>
                </div>`;
        });
        html += `</div>`;
        return html;
    }

    function renderAnaliseDespesas(dados) {
        if (dados.length === 0) {
            return `<p class="text-center text-gray-500 py-12">Nenhum dado encontrado para analisar.</p>`;
        }

        const categorias = {};
        dados.forEach(d => {
            const categoriaId = d.categoriaId || 'sem-categoria';
            const categoriaNome = d.categoriaNome || 'Sem Categoria';
            if (!categorias[categoriaId]) {
                categorias[categoriaId] = { nome: categoriaNome, totalOriginal: 0, totalPago: 0, aPagar: 0 };
            }
            categorias[categoriaId].totalOriginal += d.valorOriginal || 0;
            categorias[categoriaId].totalPago += d.totalPago || 0;
            categorias[categoriaId].aPagar += d.valorSaldo || 0;
        });

        let html = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total (Original)</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Pago</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total a Pagar</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">`;

        Object.values(categorias).sort((a,b) => b.totalOriginal - a.totalOriginal).forEach(cat => {
            html += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">${cat.nome}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-bold">${formatCurrency(cat.totalOriginal)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">${formatCurrency(cat.totalPago)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">${formatCurrency(cat.aPagar)}</td>
                </tr>
            `;
        });
        html += `</tbody></table></div>`;
        return html;
    }

    // --- Event Handlers ---

    gerarRelatorioPagarBtn.addEventListener('click', async () => {
        gerarRelatorioPagarBtn.disabled = true;
        gerarRelatorioPagarBtn.innerHTML = '<span class="material-symbols-outlined text-base mr-2 animate-spin">refresh</span> Gerando...';
        visualizacaoAreaPagar.innerHTML = `<p class="text-center text-gray-500 py-12"><span class="material-symbols-outlined text-2xl animate-spin">sync</span> Carregando dados...</p>`;

        const filtros = {
            periodoDe: pagarPeriodoDeInput.value,
            periodoAte: pagarPeriodoAteInput.value,
            beneficiarioId: pagarBeneficiarioSelect.value,
            status: pagarStatusSelect.value,
            tipo: pagarTipoSelect.value
        };

        try {
            let q = collection(db, `users/${userId}/despesas`);
            let queryConstraints = [];

            // A previsão não deve ser limitada pelo período selecionado, mas sim por tudo que está em aberto para o futuro.
            if (filtros.tipo !== 'previsao-desembolsos') {
                if (filtros.periodoDe) queryConstraints.push(where("vencimento", ">=", filtros.periodoDe));
                if (filtros.periodoAte) queryConstraints.push(where("vencimento", "<=", filtros.periodoAte));
            }

            queryConstraints.push(orderBy("vencimento", "asc"));

            q = query(q, ...queryConstraints);
            const snapshot = await getDocs(q);

            relatorioDadosPagarBase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            processarRelatorioPagar(filtros.tipo, filtros);

        } catch (error) {
            console.error("Erro ao gerar relatório de Contas a Pagar:", error);
            visualizacaoAreaPagar.innerHTML = `<p class="text-center text-red-500 py-12">Erro ao carregar o relatório: ${error.message}</p>`;
        } finally {
            gerarRelatorioPagarBtn.disabled = false;
            gerarRelatorioPagarBtn.innerHTML = '<span class="material-symbols-outlined text-base mr-2">analytics</span> Gerar Relatório';
        }
    });

    gerarRelatorioReceberBtn.addEventListener('click', async () => {
        gerarRelatorioReceberBtn.disabled = true;
        gerarRelatorioReceberBtn.innerHTML = '<span class="material-symbols-outlined text-base mr-2 animate-spin">refresh</span> Gerando...';
        visualizacaoAreaReceber.innerHTML = `<p class="text-center text-gray-500 py-12"><span class="material-symbols-outlined text-2xl animate-spin">sync</span> Carregando dados...</p>`;

        const filtros = {
            periodoDe: receberPeriodoDeInput.value,
            periodoAte: receberPeriodoAteInput.value,
            clienteId: receberClienteSelect.value,
            status: receberStatusSelect.value,
            tipo: receberTipoSelect.value
        };

        try {
            let q = collection(db, `users/${userId}/receitas`);
            let queryConstraints = [];

            if (filtros.periodoDe) queryConstraints.push(where("dataVencimento", ">=", filtros.periodoDe));
            if (filtros.periodoAte) queryConstraints.push(where("dataVencimento", "<=", filtros.periodoAte));
            if (filtros.clienteId !== 'todos') queryConstraints.push(where("clienteId", "==", filtros.clienteId));

            // Status é filtrado no lado do cliente para incluir lógicas complexas (ex: Vencido) e evitar queries compostas
            queryConstraints.push(orderBy("dataVencimento", "asc"));

            q = query(q, ...queryConstraints);
            const snapshot = await getDocs(q);

            relatorioDadosBase = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(d => d.status !== 'Desdobrado'); // Sempre excluir desdobrados da visão principal

            processarRelatorioReceber(filtros.tipo, filtros);

        } catch (error) {
            console.error("Erro ao gerar relatório:", error);
            visualizacaoAreaReceber.innerHTML = `<p class="text-center text-red-500 py-12">Erro ao carregar o relatório: ${error.message}</p>`;
        } finally {
            gerarRelatorioReceberBtn.disabled = false;
            gerarRelatorioReceberBtn.innerHTML = '<span class="material-symbols-outlined text-base mr-2">analytics</span> Gerar Relatório';
        }
    });

    function toggleReportFilters(selectElement, statusElement) {
        const selectedType = selectElement.value;
        const statusContainer = statusElement.parentElement;

        // Oculta o status para relatórios de aging/análise de atraso
        if (selectedType === 'inadimplencia' || selectedType === 'analise-atraso') {
            statusContainer.classList.add('hidden');
        } else {
            statusContainer.classList.remove('hidden');
        }
    }

    receberTipoSelect.addEventListener('change', () => {
        toggleReportFilters(receberTipoSelect, receberStatusSelect);
        if (relatorioDadosBase.length > 0) {
            processarRelatorioReceber(receberTipoSelect.value, {
                periodoDe: receberPeriodoDeInput.value,
                periodoAte: receberPeriodoAteInput.value,
                clienteId: receberClienteSelect.value,
                status: receberStatusSelect.value,
                tipo: receberTipoSelect.value
            });
        } else {
             tituloRelatorioReceberEl.textContent = `Relatório: ${receberTipoSelect.options[receberTipoSelect.selectedIndex].textContent}`;
             visualizacaoAreaReceber.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione os filtros e clique em "Gerar Relatório".</p>`;
             exportarRelatorioReceberBtn.disabled = true;
        }
    });

    pagarTipoSelect.addEventListener('change', () => {
        toggleReportFilters(pagarTipoSelect, pagarStatusSelect);
        // Lógica similar para Contas a Pagar
        tituloRelatorioPagarEl.textContent = `Relatório: ${pagarTipoSelect.options[pagarTipoSelect.selectedIndex].textContent}`;
        visualizacaoAreaPagar.innerHTML = `<p class="text-center text-gray-500 py-12">Selecione os filtros e clique em "Gerar Relatório".</p>`;
        exportarRelatorioPagarBtn.disabled = true;
    });


    // --- Exportação ---
    exportarRelatorioReceberBtn.addEventListener('click', () => {
         alert('Funcionalidade de exportação em desenvolvimento.');
    });
     exportarRelatorioPagarBtn.addEventListener('click', () => {
         alert('Funcionalidade de exportação em desenvolvimento.');
    });


    // --- Setup Inicial ---
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

    populateClientesDropdown();
    populateBeneficiariosDropdown();
    toggleReportFilters(receberTipoSelect, receberStatusSelect);
    toggleReportFilters(pagarTipoSelect, pagarStatusSelect);
}