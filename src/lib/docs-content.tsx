import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  LogIn,
  LayoutDashboard,
  FileText,
  FilePlus,
  Upload,
  Eye,
  Package,
  Code2,
  CreditCard,
  Fingerprint,
  Camera,
  BarChart3,
  Settings,
} from 'lucide-react'

export interface DocsArticle {
  slug: string
  title: string
  icon: LucideIcon
  content: () => ReactNode
}

export interface DocsSection {
  id: string
  title: string
  articles: DocsArticle[]
}

function Step({ children }: { children: ReactNode }) {
  return <ol className="list-decimal list-inside space-y-3 text-sm text-[var(--color-text)]">{children}</ol>
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-blue-500/5 p-4 text-sm text-[var(--color-text)]">
      <strong className="text-blue-600">Dica:</strong> {children}
    </div>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600">
      <strong>Atencao:</strong> {children}
    </div>
  )
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return <span className={`px-2 py-1 rounded text-xs font-medium text-white ${color}`}>{label}</span>
}

function StatusFlow({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium my-4">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-2">
          {i > 0 && <span className="text-[var(--color-text-muted)]">→</span>}
          <StatusBadge label={item.label} color={item.color} />
        </span>
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-[var(--color-text)] mt-6 mb-3">{children}</h2>
}

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--color-text)] leading-relaxed">{children}</p>
}

function PermissionTable({ rows }: { rows: { perfil: string; pode: string; nao_pode?: string }[] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border border-[var(--color-border)] rounded-lg">
        <thead>
          <tr className="bg-[var(--color-card)]">
            <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Perfil</th>
            <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Pode fazer</th>
            {rows.some(r => r.nao_pode) && (
              <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Nao pode</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.perfil} className="border-b border-[var(--color-border)] last:border-0">
              <td className="px-4 py-2 font-medium">{row.perfil}</td>
              <td className="px-4 py-2">{row.pode}</td>
              {rows.some(r => r.nao_pode) && <td className="px-4 py-2">{row.nao_pode || '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const docsContent: DocsSection[] = [
  // ============================================================
  // SEÇÃO 1: ACESSO
  // ============================================================
  {
    id: 'acesso',
    title: 'Acesso ao Sistema',
    articles: [
      {
        slug: 'login',
        title: 'Login e Autenticacao',
        icon: LogIn,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              O sistema de faturamento e acessado pelo navegador web. Voce precisa de um email e senha cadastrados
              por um administrador para entrar.
            </Paragraph>

            <SectionTitle>Como fazer login</SectionTitle>
            <Step>
              <li>Abra o navegador e acesse o endereco do sistema fornecido pela sua empresa</li>
              <li>Na tela de login, digite seu <strong>email</strong> cadastrado</li>
              <li>Digite sua <strong>senha</strong></li>
              <li>Clique no botao <strong>Entrar</strong></li>
              <li>Voce sera redirecionado para o Dashboard</li>
            </Step>

            <SectionTitle>Perfis de acesso</SectionTitle>
            <Paragraph>
              Existem 3 perfis com diferentes permissoes:
            </Paragraph>
            <PermissionTable rows={[
              { perfil: 'Administrador', pode: 'Acesso total: guias, lotes, cobrancas, configuracoes, usuarios', nao_pode: '—' },
              { perfil: 'Operador', pode: 'Guias, lotes, cobrancas, tokens, relatorios, emissao', nao_pode: 'Configuracoes e gestao de usuarios' },
              { perfil: 'Visualizador', pode: 'Ver lista de guias (somente leitura)', nao_pode: 'Criar, editar, emitir ou gerenciar qualquer recurso' },
            ]} />

            <SectionTitle>Esqueci minha senha</SectionTitle>
            <Step>
              <li>Na tela de login, clique em <strong>Esqueceu a senha?</strong></li>
              <li>Digite seu email cadastrado</li>
              <li>Verifique sua caixa de entrada e siga as instrucoes do email</li>
            </Step>

            <Tip>Se voce nao recebeu o email de recuperacao, verifique a pasta de spam ou entre em contato com o administrador do sistema.</Tip>
          </div>
        ),
      },
    ],
  },

  // ============================================================
  // SEÇÃO 2: DASHBOARD
  // ============================================================
  {
    id: 'dashboard',
    title: 'Dashboard',
    articles: [
      {
        slug: 'dashboard',
        title: 'Painel de Indicadores',
        icon: LayoutDashboard,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              O Dashboard e a pagina inicial do sistema. Ele mostra um resumo completo do faturamento do mes
              selecionado atraves de cards com indicadores (KPIs).
            </Paragraph>

            <SectionTitle>Filtro por mes</SectionTitle>
            <Paragraph>
              No topo da pagina, use o seletor de mes para escolher o periodo que deseja visualizar.
              Ao mudar o mes, todos os indicadores sao recalculados automaticamente.
            </Paragraph>

            <SectionTitle>Indicadores do Pipeline de Guias</SectionTitle>
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border border-[var(--color-border)] rounded-lg">
                <thead>
                  <tr className="bg-[var(--color-card)]">
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Card</th>
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">O que significa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr><td className="px-4 py-2 font-medium">Total de Guias</td><td className="px-4 py-2">Quantidade total de guias no mes</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Pendentes</td><td className="px-4 py-2">Guias que ainda precisam ser completadas</td></tr>
                  <tr><td className="px-4 py-2 font-medium">CPro</td><td className="px-4 py-2">Guias aguardando registro no ConsultorioPro</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Token</td><td className="px-4 py-2">Guias aguardando biometria do paciente</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Completas</td><td className="px-4 py-2">Guias prontas para serem incluidas em um lote</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Processadas</td><td className="px-4 py-2">Guias ja enviadas a operadora</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Faturadas</td><td className="px-4 py-2">Guias aceitas e faturadas pela operadora</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Lotes Abertos</td><td className="px-4 py-2">Quantidade de lotes em rascunho</td></tr>
                </tbody>
              </table>
            </div>

            <SectionTitle>Indicadores Financeiros</SectionTitle>
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border border-[var(--color-border)] rounded-lg">
                <thead>
                  <tr className="bg-[var(--color-card)]">
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Card</th>
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">O que significa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr><td className="px-4 py-2 font-medium">Valor Total</td><td className="px-4 py-2">Soma dos valores de todas as guias do mes</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Valor Completas</td><td className="px-4 py-2">Valor das guias prontas para faturamento</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Valor Processadas</td><td className="px-4 py-2">Valor ja enviado a operadora</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Valor Faturado</td><td className="px-4 py-2">Valor efetivamente faturado e aceito</td></tr>
                </tbody>
              </table>
            </div>

            <Tip>Os cards mudam de cor conforme o valor: verde indica progresso positivo, vermelho indica pendencias.</Tip>
          </div>
        ),
      },
    ],
  },

  // ============================================================
  // SEÇÃO 3: GUIAS
  // ============================================================
  {
    id: 'guias',
    title: 'Guias',
    articles: [
      {
        slug: 'guias',
        title: 'Lista de Guias',
        icon: FileText,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              A pagina de Guias e o coracao do sistema. Aqui voce visualiza todas as guias de autorizacao
              medica, filtra por status ou mes, e realiza acoes como importar ou reimportar.
            </Paragraph>

            <SectionTitle>Busca e filtros</SectionTitle>
            <Step>
              <li>Use o campo de <strong>busca</strong> para procurar por numero da guia, nome do paciente ou numero da carteira</li>
              <li>Use o filtro de <strong>status</strong> para ver apenas guias em um determinado estado</li>
              <li>Use o filtro de <strong>mes</strong> para selecionar o periodo de referencia</li>
            </Step>

            <SectionTitle>Fluxo de status das guias</SectionTitle>
            <Paragraph>
              Cada guia passa por um fluxo de status. Entender esse fluxo e fundamental:
            </Paragraph>
            <StatusFlow items={[
              { label: 'PENDENTE', color: 'bg-slate-500' },
              { label: 'CPRO', color: 'bg-amber-500' },
              { label: 'TOKEN', color: 'bg-orange-500' },
              { label: 'COMPLETA', color: 'bg-green-500' },
              { label: 'PROCESSADA', color: 'bg-blue-500' },
              { label: 'FATURADA', color: 'bg-purple-500' },
            ]} />

            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border border-[var(--color-border)] rounded-lg">
                <thead>
                  <tr className="bg-[var(--color-card)]">
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Status</th>
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Significado</th>
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">O que fazer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr><td className="px-4 py-2 font-medium">PENDENTE</td><td className="px-4 py-2">Guia importada, faltam dados</td><td className="px-4 py-2">Reimportar ou completar dados</td></tr>
                  <tr><td className="px-4 py-2 font-medium">CPRO</td><td className="px-4 py-2">Falta registro no ConsultorioPro</td><td className="px-4 py-2">Registrar execucoes no CPro</td></tr>
                  <tr><td className="px-4 py-2 font-medium">TOKEN</td><td className="px-4 py-2">Aguardando biometria do paciente</td><td className="px-4 py-2">Enviar token via WhatsApp ou resolver manualmente</td></tr>
                  <tr><td className="px-4 py-2 font-medium">COMPLETA</td><td className="px-4 py-2">Pronta para incluir em lote</td><td className="px-4 py-2">Criar ou adicionar a um lote</td></tr>
                  <tr><td className="px-4 py-2 font-medium">PROCESSADA</td><td className="px-4 py-2">Enviada a operadora</td><td className="px-4 py-2">Aguardar retorno</td></tr>
                  <tr><td className="px-4 py-2 font-medium">FATURADA</td><td className="px-4 py-2">Aceita e faturada</td><td className="px-4 py-2">Acompanhar pagamento</td></tr>
                  <tr><td className="px-4 py-2 font-medium">CANCELADA</td><td className="px-4 py-2">Guia cancelada no portal</td><td className="px-4 py-2">Nenhuma acao necessaria</td></tr>
                  <tr><td className="px-4 py-2 font-medium">NEGADA</td><td className="px-4 py-2">Guia negada pela operadora</td><td className="px-4 py-2">Verificar motivo e reemitir se necessario</td></tr>
                </tbody>
              </table>
            </div>

            <SectionTitle>Acoes da pagina</SectionTitle>
            <Step>
              <li><strong>Importar Guias:</strong> Clique no botao para importar novas guias do portal SAW</li>
              <li><strong>Re-importar Pendentes:</strong> Reimporta guias com status PENDENTE, CPRO ou TOKEN para atualizar dados</li>
              <li><strong>Clicar em uma guia:</strong> Abre o detalhe da guia para ver informacoes completas e realizar acoes</li>
            </Step>

            <Tip>O icone de camera ao lado de uma guia indica que o paciente ja possui fotos biometricas cadastradas.</Tip>
          </div>
        ),
      },
      {
        slug: 'emitir-guia',
        title: 'Emitir Guia',
        icon: FilePlus,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              A emissao de guia cria uma nova autorizacao diretamente no portal SAW da Unimed e registra
              automaticamente no ConsultorioPro. O processo e feito em etapas automaticas (pipeline).
            </Paragraph>

            <SectionTitle>Como emitir uma guia</SectionTitle>
            <Step>
              <li>Acesse <strong>Emitir Guia</strong> no menu lateral</li>
              <li>Preencha os dados do paciente:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><strong>Nome do paciente:</strong> Nome completo</li>
                  <li><strong>Numero da carteira:</strong> O prefixo 0865 ja vem preenchido, complete com o restante</li>
                  <li><strong>Quantidade:</strong> Numero de sessoes</li>
                  <li><strong>Indicacao clinica:</strong> Descricao do motivo</li>
                </ul>
              </li>
              <li>Selecione o <strong>mes de referencia</strong></li>
              <li>Na secao CPro, selecione o <strong>profissional</strong> e o <strong>convenio</strong></li>
              <li>Ajuste o <strong>multiplicador</strong> se necessario (1x ou 2x)</li>
              <li>Preencha os dados de atendimento (data, hora, duracao)</li>
              <li>Clique em <strong>Emitir</strong></li>
            </Step>

            <SectionTitle>Pipeline de emissao (4 etapas)</SectionTitle>
            <Paragraph>Apos clicar em Emitir, o sistema executa automaticamente:</Paragraph>
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border border-[var(--color-border)] rounded-lg">
                <thead>
                  <tr className="bg-[var(--color-card)]">
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Passo</th>
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">O que acontece</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr><td className="px-4 py-2 font-medium">1. Emitir</td><td className="px-4 py-2">Cria a guia no portal SAW da Unimed</td></tr>
                  <tr><td className="px-4 py-2 font-medium">2. Importar</td><td className="px-4 py-2">Importa os dados da guia recem-criada para o sistema</td></tr>
                  <tr><td className="px-4 py-2 font-medium">3. CPro</td><td className="px-4 py-2">Registra as execucoes no ConsultorioPro</td></tr>
                  <tr><td className="px-4 py-2 font-medium">4. Verificar</td><td className="px-4 py-2">Confirma que tudo foi registrado corretamente</td></tr>
                </tbody>
              </table>
            </div>

            <Paragraph>
              Acompanhe o progresso no terminal de logs que aparece abaixo do formulario. Mensagens em
              verde indicam sucesso, amarelo indica avisos, e vermelho indica erros.
            </Paragraph>

            <Warning>Nao feche a pagina enquanto o pipeline estiver em execucao. Se houver erro, verifique o log e tente novamente.</Warning>
          </div>
        ),
      },
      {
        slug: 'importar-guias',
        title: 'Importar Guias',
        icon: Upload,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              A importacao busca dados de guias do portal SAW da Unimed e salva no sistema.
              Existem dois modos de importacao.
            </Paragraph>

            <SectionTitle>Modo 1: Importar por numero</SectionTitle>
            <Step>
              <li>Acesse <strong>Guias</strong> e clique em <strong>Importar Guias</strong></li>
              <li>No campo de texto, cole os numeros das guias separados por virgula (ex: 123456, 789012)</li>
              <li>Selecione o <strong>mes de referencia</strong></li>
              <li>Clique em <strong>Importar</strong></li>
            </Step>

            <SectionTitle>Modo 2: Re-importar por status</SectionTitle>
            <Step>
              <li>Clique em <strong>Re-importar Pendentes</strong> na pagina de Guias</li>
              <li>O sistema busca todas as guias com status PENDENTE, CPRO ou TOKEN</li>
              <li>Cada guia e reimportada para atualizar seus dados do portal</li>
            </Step>

            <SectionTitle>Terminal de logs</SectionTitle>
            <Paragraph>
              Durante a importacao, um terminal mostra o progresso em tempo real:
            </Paragraph>
            <ul className="list-disc list-inside text-sm space-y-1 text-[var(--color-text)]">
              <li><span className="text-green-600 font-medium">Verde:</span> Guia importada com sucesso</li>
              <li><span className="text-yellow-600 font-medium">Amarelo:</span> Aviso (ex: guia ja existe, dados parciais)</li>
              <li><span className="text-red-600 font-medium">Vermelho:</span> Erro na importacao da guia</li>
            </ul>

            <Tip>A barra de progresso no topo mostra quantas guias ja foram processadas e o tempo decorrido.</Tip>
          </div>
        ),
      },
      {
        slug: 'detalhe-guia',
        title: 'Detalhe da Guia',
        icon: Eye,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              Ao clicar em uma guia na lista, voce acessa a pagina de detalhe com todas as informacoes
              e acoes disponiveis para aquela guia.
            </Paragraph>

            <SectionTitle>Informacoes exibidas</SectionTitle>
            <ul className="list-disc list-inside text-sm space-y-1 text-[var(--color-text)]">
              <li><strong>Numero da guia:</strong> Identificador unico no portal SAW</li>
              <li><strong>Paciente:</strong> Nome completo e numero da carteira</li>
              <li><strong>Status:</strong> Estado atual com indicador visual colorido</li>
              <li><strong>Valor total:</strong> Valor da guia conforme contrato</li>
              <li><strong>Mes de referencia:</strong> Competencia da guia (editavel)</li>
              <li><strong>Procedimentos:</strong> Lista de procedimentos com codigo, descricao e valor</li>
            </ul>

            <SectionTitle>Secao de biometria</SectionTitle>
            <Paragraph>
              Na area de biometria voce pode:
            </Paragraph>
            <ul className="list-disc list-inside text-sm space-y-1 text-[var(--color-text)]">
              <li>Ver fotos ja capturadas do paciente (ate 4 fotos por guia)</li>
              <li>Capturar novas fotos usando a camera do dispositivo</li>
              <li>Enviar link Bioface para o paciente capturar a propria foto</li>
            </ul>

            <SectionTitle>Acoes disponiveis</SectionTitle>
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border border-[var(--color-border)] rounded-lg">
                <thead>
                  <tr className="bg-[var(--color-card)]">
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Acao</th>
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Descricao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr><td className="px-4 py-2 font-medium">Reimportar</td><td className="px-4 py-2">Busca dados atualizados do portal SAW</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Enviar Token WhatsApp</td><td className="px-4 py-2">Envia solicitacao de biometria ao paciente por WhatsApp</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Capturar Biometria</td><td className="px-4 py-2">Abre a camera para captura facial</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Editar Mes Ref.</td><td className="px-4 py-2">Altera o mes de referencia da guia</td></tr>
                </tbody>
              </table>
            </div>

            <Tip>O mes de referencia pode ser editado diretamente clicando no campo — selecione o mes correto e a alteracao e salva automaticamente.</Tip>
          </div>
        ),
      },
    ],
  },

  // ============================================================
  // SEÇÃO 4: LOTES
  // ============================================================
  {
    id: 'lotes',
    title: 'Lotes',
    articles: [
      {
        slug: 'lotes',
        title: 'Gerenciamento de Lotes',
        icon: Package,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              Lotes agrupam guias completas para envio a operadora Unimed. Cada lote gera um arquivo
              XML no padrao TISS que e submetido para faturamento.
            </Paragraph>

            <SectionTitle>Criar um novo lote</SectionTitle>
            <Step>
              <li>Acesse <strong>Lotes</strong> no menu lateral</li>
              <li>Clique em <strong>Novo Lote</strong></li>
              <li>Preencha:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><strong>Numero do lote:</strong> Automatico ou manual</li>
                  <li><strong>Tipo:</strong> Local (carteiras 0865) ou Intercambio (outras carteiras)</li>
                  <li><strong>Mes de referencia:</strong> Competencia do lote</li>
                  <li><strong>Observacoes:</strong> Opcional</li>
                </ul>
              </li>
              <li>Selecione as guias que deseja incluir (somente guias com status COMPLETA aparecem)</li>
              <li>Se necessario, edite o <strong>valor unitario</strong> de cada guia clicando no campo de valor</li>
              <li>Confira o resumo (total de guias e valor total)</li>
              <li>Clique em <strong>Criar Lote</strong></li>
            </Step>

            <SectionTitle>Fluxo de status do lote</SectionTitle>
            <StatusFlow items={[
              { label: 'RASCUNHO', color: 'bg-slate-500' },
              { label: 'GERADO', color: 'bg-blue-500' },
              { label: 'ENVIADO', color: 'bg-indigo-500' },
              { label: 'ACEITO', color: 'bg-teal-500' },
              { label: 'PROCESSADO', color: 'bg-cyan-500' },
              { label: 'FATURADO', color: 'bg-purple-500' },
              { label: 'PAGO', color: 'bg-green-500' },
            ]} />

            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border border-[var(--color-border)] rounded-lg">
                <thead>
                  <tr className="bg-[var(--color-card)]">
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Status</th>
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Significado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr><td className="px-4 py-2 font-medium">Rascunho</td><td className="px-4 py-2">Lote criado, aguardando gerar XML</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Gerado</td><td className="px-4 py-2">XML TISS gerado, pronto para envio</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Enviado</td><td className="px-4 py-2">XML enviado a operadora</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Aceito</td><td className="px-4 py-2">Operadora aceitou o lote</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Processado</td><td className="px-4 py-2">Lote em processamento na operadora</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Faturado</td><td className="px-4 py-2">Valores confirmados para pagamento</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Glosado</td><td className="px-4 py-2">Lote recusado (parcial ou total)</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Pago</td><td className="px-4 py-2">Pagamento recebido</td></tr>
                </tbody>
              </table>
            </div>

            <Warning>Ao excluir um lote, as guias associadas voltam ao status COMPLETA e podem ser incluidas em outro lote.</Warning>
          </div>
        ),
      },
    ],
  },

  // ============================================================
  // SEÇÃO 5: XML TISS
  // ============================================================
  {
    id: 'xml',
    title: 'XML TISS',
    articles: [
      {
        slug: 'xml-tiss',
        title: 'Gerar e Baixar XML',
        icon: Code2,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              O XML TISS e o arquivo padrao exigido pela ANS (Agencia Nacional de Saude Suplementar)
              para envio de faturamento as operadoras. O sistema gera XMLs no padrao TISS versao 4.02.00.
            </Paragraph>

            <SectionTitle>Como gerar o XML</SectionTitle>
            <Step>
              <li>Acesse <strong>Lotes</strong> e clique no lote desejado</li>
              <li>No detalhe do lote, clique em <strong>Gerar XML TISS</strong></li>
              <li>O sistema gera o XML com todos os dados das guias do lote</li>
              <li>Uma pre-visualizacao do XML aparece na tela</li>
              <li>Clique em <strong>Download</strong> para baixar o arquivo .xml</li>
            </Step>

            <SectionTitle>O que o XML contem</SectionTitle>
            <ul className="list-disc list-inside text-sm space-y-1 text-[var(--color-text)]">
              <li>Dados do prestador (CNPJ, CNES, registro ANS)</li>
              <li>Dados de cada guia (numero, paciente, carteira)</li>
              <li>Procedimentos realizados com codigos, datas e valores</li>
              <li>Dados dos profissionais executantes (CPF, conselho, CBOS)</li>
              <li>Hash MD5 para validacao de integridade</li>
            </ul>

            <Tip>O XML pode ser gerado quantas vezes necessario. Cada geracao substitui o anterior. Baixe o arquivo antes de gerar novamente se precisar manter versoes.</Tip>
          </div>
        ),
      },
    ],
  },

  // ============================================================
  // SEÇÃO 6: COBRANÇAS
  // ============================================================
  {
    id: 'cobrancas',
    title: 'Cobrancas',
    articles: [
      {
        slug: 'cobrancas',
        title: 'Acompanhamento de Cobrancas',
        icon: CreditCard,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              A pagina de Cobrancas permite acompanhar o status financeiro do faturamento,
              incluindo valores cobrados, pagos e glosados.
            </Paragraph>

            <SectionTitle>Cards de resumo</SectionTitle>
            <ul className="list-disc list-inside text-sm space-y-1 text-[var(--color-text)]">
              <li><strong>Total Cobrado:</strong> Soma de todos os valores em cobranca</li>
              <li><strong>Total Pago:</strong> Valores ja recebidos</li>
              <li><strong>Total Glosado:</strong> Valores recusados pela operadora</li>
            </ul>

            <SectionTitle>Status das cobrancas</SectionTitle>
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border border-[var(--color-border)] rounded-lg">
                <thead>
                  <tr className="bg-[var(--color-card)]">
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Status</th>
                    <th className="text-left px-4 py-2 border-b border-[var(--color-border)] font-medium">Significado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr><td className="px-4 py-2 font-medium">Pendente</td><td className="px-4 py-2">Cobranca criada, aguardando envio</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Enviada</td><td className="px-4 py-2">Cobranca enviada a operadora</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Paga</td><td className="px-4 py-2">Pagamento confirmado</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Glosada</td><td className="px-4 py-2">Valor recusado pela operadora</td></tr>
                  <tr><td className="px-4 py-2 font-medium">Recurso</td><td className="px-4 py-2">Recurso de glosa em andamento</td></tr>
                </tbody>
              </table>
            </div>

            <SectionTitle>Filtros</SectionTitle>
            <Paragraph>
              Use os filtros de status e mes para encontrar cobrancas especificas.
              O botao de atualizar recarrega os dados do servidor.
            </Paragraph>
          </div>
        ),
      },
    ],
  },

  // ============================================================
  // SEÇÃO 7: TOKENS E BIOMETRIA
  // ============================================================
  {
    id: 'tokens',
    title: 'Tokens e Biometria',
    articles: [
      {
        slug: 'tokens',
        title: 'Tokens Biometricos',
        icon: Fingerprint,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              Algumas guias exigem verificacao biometrica do paciente antes de serem autorizadas.
              A pagina de Tokens mostra todas as guias aguardando essa verificacao e permite resolve-las.
            </Paragraph>

            <SectionTitle>Tokens pendentes</SectionTitle>
            <Paragraph>
              A tabela de tokens pendentes lista todas as guias com status TOKEN. Para cada guia voce pode:
            </Paragraph>
            <ul className="list-disc list-inside text-sm space-y-1 text-[var(--color-text)]">
              <li><strong>Enviar via WhatsApp:</strong> Envia uma mensagem ao paciente pedindo que realize a biometria</li>
              <li><strong>Capturar no app:</strong> Abre a camera para captura facial presencial</li>
            </ul>

            <SectionTitle>Como resolver um token via WhatsApp</SectionTitle>
            <Step>
              <li>Na lista de tokens pendentes, clique no botao de <strong>WhatsApp</strong> ao lado da guia</li>
              <li>O sistema envia automaticamente uma mensagem ao paciente com instrucoes</li>
              <li>O paciente responde com o codigo de 6 digitos recebido</li>
              <li>O sistema captura a resposta e submete ao portal automaticamente</li>
              <li>A guia muda de TOKEN para COMPLETA quando a biometria e aceita</li>
            </Step>

            <SectionTitle>Tokens resolvidos</SectionTitle>
            <Paragraph>
              A segunda tabela mostra guias que ja tiveram o token resolvido com sucesso,
              permitindo acompanhar o historico.
            </Paragraph>

            <Warning>O token tem validade de aproximadamente 4 minutos e 30 segundos. Se expirar, sera necessario enviar um novo.</Warning>
          </div>
        ),
      },
      {
        slug: 'bioface',
        title: 'Bioface (Captura Publica)',
        icon: Camera,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              O Bioface e uma pagina publica que permite ao paciente capturar sua propria foto facial
              sem precisar de login no sistema. O link e enviado ao paciente por WhatsApp ou compartilhado
              diretamente.
            </Paragraph>

            <SectionTitle>Como funciona para o paciente</SectionTitle>
            <Step>
              <li>O paciente recebe um link unico (ex: /bioface/abc123?t=token)</li>
              <li>Ao acessar, ve seus dados (nome e numero da guia) para confirmar a identidade</li>
              <li>Marca a caixa de <strong>consentimento LGPD</strong> autorizando o uso da imagem</li>
              <li>Permite acesso a camera do celular ou computador</li>
              <li>Posiciona o rosto no enquadramento indicado</li>
              <li>Clica em <strong>Capturar</strong></li>
              <li>Recebe confirmacao de que a foto foi salva com sucesso</li>
            </Step>

            <SectionTitle>Para o operador</SectionTitle>
            <Paragraph>
              O link Bioface pode ser obtido na pagina de detalhe da guia, na secao de biometria.
              Cada guia pode ter ate 4 fotos. As fotos sao armazenadas de forma segura e
              associadas ao numero da carteira do paciente.
            </Paragraph>

            <Tip>O link Bioface nao requer autenticacao, mas e protegido por um token unico. Compartilhe apenas com o paciente.</Tip>
          </div>
        ),
      },
    ],
  },

  // ============================================================
  // SEÇÃO 8: RELATÓRIOS
  // ============================================================
  {
    id: 'relatorios',
    title: 'Relatorios',
    articles: [
      {
        slug: 'relatorios',
        title: 'Graficos e Indicadores',
        icon: BarChart3,
        content: () => (
          <div className="space-y-4">
            <Paragraph>
              A pagina de Relatorios apresenta graficos visuais com a distribuicao de guias e valores
              por status, permitindo uma visao analitica do faturamento.
            </Paragraph>

            <SectionTitle>Graficos disponiveis</SectionTitle>
            <ul className="list-disc list-inside text-sm space-y-1 text-[var(--color-text)]">
              <li><strong>Distribuicao de guias por status:</strong> Grafico de pizza mostrando quantas guias estao em cada status</li>
              <li><strong>Distribuicao de lotes por status:</strong> Grafico de pizza com status dos lotes</li>
              <li><strong>Valor por status de guia:</strong> Quanto dinheiro esta em cada fase do pipeline</li>
              <li><strong>Valor por status de lote:</strong> Valores agrupados pelo status do lote</li>
            </ul>

            <SectionTitle>Filtro por mes</SectionTitle>
            <Paragraph>
              Use o seletor de mes para filtrar os dados exibidos. Os graficos e cards
              sao recalculados automaticamente para o periodo selecionado.
            </Paragraph>

            <Tip>Os relatorios sao uteis para acompanhar o progresso mensal do faturamento e identificar gargalos (muitas guias pendentes, por exemplo).</Tip>
          </div>
        ),
      },
    ],
  },

  // ============================================================
  // SEÇÃO 9: CONFIGURAÇÕES
  // ============================================================
  {
    id: 'configuracoes',
    title: 'Configuracoes',
    articles: [
      {
        slug: 'configuracoes',
        title: 'Configuracoes do Sistema',
        icon: Settings,
        content: () => (
          <div className="space-y-4">
            <Warning>As configuracoes sao acessiveis apenas para usuarios com perfil <strong>Administrador</strong>.</Warning>

            <Paragraph>
              A area de configuracoes permite gerenciar os dados do prestador, as integracoes
              com sistemas externos e os usuarios do sistema.
            </Paragraph>

            <SectionTitle>Dados do Prestador</SectionTitle>
            <Paragraph>
              Informacoes cadastrais usadas na geracao do XML TISS:
            </Paragraph>
            <ul className="list-disc list-inside text-sm space-y-1 text-[var(--color-text)]">
              <li><strong>Nome:</strong> Razao social do prestador</li>
              <li><strong>Codigo do prestador:</strong> Codigo ANS</li>
              <li><strong>Registro ANS:</strong> Numero de registro na agencia</li>
              <li><strong>CNES:</strong> Cadastro Nacional de Estabelecimentos de Saude</li>
              <li><strong>CNPJ:</strong> Cadastro da pessoa juridica</li>
              <li><strong>Padrao TISS:</strong> Versao do padrao (4.02.00)</li>
            </ul>

            <SectionTitle>Integracoes</SectionTitle>
            <Paragraph>O sistema se conecta a dois sistemas externos:</Paragraph>

            <div className="space-y-3 my-4">
              <div className="rounded-lg border border-[var(--color-border)] p-4">
                <h3 className="font-semibold text-sm mb-2">SAW (Sistema de Autorizacao Integrada)</h3>
                <Paragraph>
                  Portal da Unimed para emissao e consulta de guias. Configure a URL de acesso,
                  usuario e senha. Use o botao <strong>Testar Conexao</strong> para verificar se as
                  credenciais estao corretas.
                </Paragraph>
              </div>

              <div className="rounded-lg border border-[var(--color-border)] p-4">
                <h3 className="font-semibold text-sm mb-2">ConsultorioPro (CPro)</h3>
                <Paragraph>
                  Sistema de gestao do consultorio. Configure a URL da API e as credenciais de acesso.
                  O indicador de status mostra se a conexao esta ativa.
                </Paragraph>
              </div>
            </div>

            <SectionTitle>Gestao de Usuarios</SectionTitle>
            <Step>
              <li>Acesse <strong>Configuracoes &gt; Usuarios</strong></li>
              <li>Visualize a lista de todos os usuarios com seus perfis</li>
              <li>Para criar um novo usuario, clique em <strong>Novo usuario</strong> e preencha email, nome, perfil e senha</li>
              <li>Para editar, clique no usuario e altere os campos desejados</li>
              <li>Para remover, use o botao de exclusao (nao e possivel excluir a si mesmo)</li>
            </Step>

            <PermissionTable rows={[
              { perfil: 'Administrador', pode: 'Criar, editar e excluir qualquer usuario' },
              { perfil: 'Operador', pode: 'Editar apenas seu proprio perfil' },
              { perfil: 'Visualizador', pode: 'Editar apenas seu proprio perfil' },
            ]} />
          </div>
        ),
      },
    ],
  },
]

export function findArticle(slug: string): DocsArticle | undefined {
  for (const section of docsContent) {
    const article = section.articles.find(a => a.slug === slug)
    if (article) return article
  }
  return undefined
}

export function getDefaultSlug(): string {
  return docsContent[0]?.articles[0]?.slug ?? 'login'
}
