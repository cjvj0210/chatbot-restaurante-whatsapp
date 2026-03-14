/**
 * Cache de FAQ — respostas instantâneas para perguntas frequentes
 * Evita chamada ao LLM para perguntas simples e repetitivas
 * Reduz custo, latência e carga no servidor
 */

interface FaqEntry {
  patterns: RegExp[];
  response: string;
  /** Palavras-chave rápidas: se nenhuma estiver presente, pula os regexes */
  quickKeywords: string[];
  /** Se true, a resposta depende do horário/dia e deve ser gerada dinamicamente */
  dynamic?: boolean;
}

/**
 * Verifica se a mensagem do usuário corresponde a uma FAQ conhecida
 * @returns resposta pronta ou null se não for FAQ
 */
export function checkFaqCache(message: string, diaSemana?: string, horarioAtual?: string): string | null {
  const normalized = message.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remover acentos

  for (const entry of FAQ_ENTRIES) {
    // Pré-filtro rápido: pular regex se nenhuma keyword estiver presente na string
    if (entry.quickKeywords.length > 0 && !entry.quickKeywords.some((kw) => normalized.includes(kw))) {
      continue;
    }

    for (const pattern of entry.patterns) {
      if (pattern.test(normalized)) {
        return entry.response;
      }
    }
  }

  return null; // Não é FAQ, precisa do LLM
}

const FAQ_ENTRIES: FaqEntry[] = [
  // --- Saudações simples ---
  {
    quickKeywords: ["oi", "ola", "hey", "eai", "bom", "boa", "opa", "fala"],
    patterns: [
      /^(oi|ola|hey|eai|e ai|bom dia|boa tarde|boa noite|opa|fala)[\s!?.]*$/,
      /^(oi|ola|hey|opa),?\s*(tudo bem|tudo bom|como vai|beleza|suave)[\s!?.]*$/,
    ],
    response: "Oi! Tudo joia por aqui! 😊 Sou o Gauchinho, atendente virtual da Churrascaria Estrela do Sul. Em que posso te ajudar? 🤠",
  },

  // --- Endereço ---
  {
    quickKeywords: ["onde", "endereco", "localiza", "chego"],
    patterns: [
      /onde (fica|e|fica o|e o|localiza)/i,
      /qual (o )?endereco/i,
      /endereco do restaurante/i,
      /como chego/i,
      /localizacao/i,
    ],
    response: "Ficamos na Av. Eng. Necker Carmago de Carvalho, 36, n 1885 - Barretos/SP 📍\n\nTelefone fixo: (17) 3325-8628\nWhatsApp: (17) 98222-2790\n\nPosso te ajudar com mais alguma coisa? 😊",
  },

  // --- Formas de pagamento ---
  {
    quickKeywords: ["pagamento", "pagar", "cartao", "pix", "dinheiro", "credito", "debito"],
    patterns: [
      /forma.?de.?pagamento/i,
      /aceita.?(cartao|pix|dinheiro|credito|debito)/i,
      /como (posso |eu )?pag(o|ar)/i,
      /quais.?pagamento/i,
    ],
    response: "Aceitamos Dinheiro, Cartao (credito e debito) e PIX! 💳\n\nPosso te ajudar com mais alguma coisa? 😊",
  },

  // --- Telefone ---
  {
    quickKeywords: ["telefone", "contato", "ligar", "numero", "whatsapp"],
    patterns: [
      /qual (o )?telefone/i,
      /numero.?(de )?telefone/i,
      /contato/i,
      /whatsapp.?(do restaurante|pra ligar)/i,
    ],
    response: "Nossos contatos:\n\nTelefone fixo: (17) 3325-8628 📞\nWhatsApp: (17) 98222-2790 📱\n\nLembrando que este numero de WhatsApp nao recebe ligacoes. Para ligar, use o telefone fixo! 😊",
  },

  // --- Taxa de serviço ---
  {
    quickKeywords: ["taxa", "servico", "gorjeta", "garcom", "10", "porcento"],
    patterns: [
      /taxa.?de.?servico/i,
      /cobr(a|am).?10/i,
      /10.?porcento/i,
      /taxa.?do.?garcom/i,
      /gorjeta/i,
    ],
    response: "Sim, cobramos uma taxa de servico de 10% sobre o consumo. Essa taxa e uma forma de reconhecer e valorizar o trabalho da nossa equipe, que se dedica para garantir a melhor experiencia possivel para voce. Todo o valor arrecadado e repassado integralmente aos nossos colaboradores. 😊\n\nPosso te ajudar com mais alguma coisa?",
  },

  // --- Aniversário ---
  {
    quickKeywords: ["aniversario", "niver", "desconto"],
    patterns: [
      /aniversario/i,
      /niver/i,
      /faco aniversario/i,
      /desconto.?aniversa/i,
    ],
    response: "Aniversariantes ganham um delicioso PETIT GATEAU COM SORVETE mediante apresentacao de documento! 🎂🍨\n\nNao ha desconto adicional no valor do rodizio.\n\nQuer fazer uma reserva para comemorar? 😊",
  },

  // --- Desconto bariátrica ---
  {
    quickKeywords: ["bariatric", "desconto", "carteirinha", "operacao"],
    patterns: [
      /bariatric/i,
      /desconto.?bariatric/i,
      /carteirinha.?bariatric/i,
      /operacao.?bariatric/i,
    ],
    response: "Sim, oferecemos desconto especial para clientes bariatricos! O valor e de R$ 10,00 de desconto mediante apresentacao da carteirinha bariatrica na entrada. 😊\n\nPosso te ajudar com mais alguma coisa?",
  },

  // --- Vagas de emprego ---
  {
    quickKeywords: ["vaga", "trabalhar", "curriculo", "contratando", "emprego"],
    patterns: [
      /vaga.?de.?emprego/i,
      /trabalhar.?(ai|aqui|no restaurante)/i,
      /enviar.?curriculo/i,
      /curriculo/i,
      /estao.?contratando/i,
    ],
    response: "Ficamos felizes com seu interesse em fazer parte da nossa equipe! 😊\n\nOs curriculos e candidaturas sao recebidos unica e exclusivamente por e-mail. Envie o seu para: estreladosulbarretos@gmail.com\n\nColoque no assunto: 'Curriculo - [seu nome]'. Nossa equipe entrara em contato caso surja uma oportunidade alinhada ao seu perfil!",
  },

  // --- Fornecedores ---
  {
    quickKeywords: ["fornecedor", "compras", "vender", "produto", "representante"],
    patterns: [
      /fornecedor/i,
      /responsavel.?(de |por )?compras/i,
      /vender.?produto/i,
      /representante.?comercial/i,
    ],
    response: "Para assuntos relacionados a fornecimento e compras, o responsavel e o Clovis. Voce pode entrar em contato diretamente pelo WhatsApp: (17) 9 8811-2790 😊",
  },

  // --- Crianças pagam? ---
  {
    quickKeywords: ["crianca", "preco", "valor", "quanto", "kids", "infantil"],
    patterns: [
      /crianca.?pag/i,
      /preco.?(de |da |pra )?crianca/i,
      /valor.?(de |da |pra )?crianca/i,
      /quanto.?crianca/i,
      /kids/i,
      /infantil/i,
    ],
    response: "Temos valores especiais para os pequenos, mediante apresentacao de documento:\n\nAte 4 anos: GRATIS! 🎉\n5 anos: R$ 29,90\n6 anos: R$ 39,90\n7 anos: R$ 43,90\n8 anos: R$ 45,90\n9 anos: R$ 54,90\n10 anos: R$ 59,90\n11 anos: R$ 64,90\n12 anos: R$ 74,90\n\nPosso te ajudar com mais alguma coisa? 😊",
  },

  // --- Taxa de entrega ---
  {
    quickKeywords: ["entrega", "frete", "taxa", "valor", "quanto"],
    patterns: [
      /taxa.?de.?entrega/i,
      /quanto.?(custa|e).?a?.?entrega/i,
      /frete/i,
      /valor.?(da |de )?entrega/i,
    ],
    response: "A taxa de entrega e R$ 8,50 para qualquer pedido! 🚚\n\nO pedido minimo e R$ 30,00.\n\nQuer ver nosso cardapio digital? 😊",
  },
];
