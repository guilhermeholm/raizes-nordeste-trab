import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const usuarios = [
  { nome: 'Administrador da Rede', email: 'admin@raizes.com', senha: 'Admin@123', perfil: 'ADMIN' },
  { nome: 'Gerente Recife Centro', email: 'gerente@raizes.com', senha: 'Gerente@123', perfil: 'GERENTE' },
  { nome: 'Atendente Balcão', email: 'atendente@raizes.com', senha: 'Atend@123', perfil: 'ATENDENTE' },
  { nome: 'Equipe Cozinha', email: 'cozinha@raizes.com', senha: 'Cozinha@123', perfil: 'COZINHA' },
  { nome: 'Maria Silva', email: 'maria@email.com', senha: 'Cliente@123', perfil: 'CLIENTE', telefone: '81999998888' },
  { nome: 'João Santos', email: 'joao@email.com', senha: 'Cliente@123', perfil: 'CLIENTE', telefone: '85988887777' },
];

const unidades = [
  { nome: 'Raízes do Nordeste - Recife Centro', endereco: 'Rua do Bom Jesus, 100 - Recife Antigo', cidade: 'Recife', estado: 'PE', cozinhaCompleta: true },
  { nome: 'Raízes do Nordeste - Boa Viagem', endereco: 'Av. Boa Viagem, 2500', cidade: 'Recife', estado: 'PE', cozinhaCompleta: true },
  { nome: 'Raízes do Nordeste - Fortaleza Aldeota', endereco: 'Av. Dom Luís, 800', cidade: 'Fortaleza', estado: 'CE', cozinhaCompleta: false },
];

const produtos = [
  { nome: 'Tapioca de Carne Seca com Queijo Coalho', descricao: 'Tapioca recheada com carne de sol desfiada e queijo coalho', categoria: 'TAPIOCA', preco: 18.9, cozinha: false },
  { nome: 'Tapioca de Coco com Leite Condensado', descricao: 'Tapioca doce com coco ralado fresco', categoria: 'TAPIOCA', preco: 14.5, cozinha: false },
  { nome: 'Cuscuz Recheado com Charque', descricao: 'Cuscuz de milho com charque desfiado e manteiga de garrafa', categoria: 'CUSCUZ', preco: 22.5, cozinha: true },
  { nome: 'Cuscuz com Ovo e Queijo', descricao: 'Cuscuz nordestino com ovo frito e queijo coalho', categoria: 'CUSCUZ', preco: 16.0, cozinha: true },
  { nome: 'Baião de Dois', descricao: 'Arroz, feijão verde, queijo coalho e nata', categoria: 'PRATO', preco: 32.9, cozinha: true },
  { nome: 'Bolo de Macaxeira', descricao: 'Fatia de bolo de macaxeira caseiro', categoria: 'BOLO', preco: 9.5, cozinha: false },
  { nome: 'Bolo de Rolo', descricao: 'Fatia de bolo de rolo pernambucano com goiabada', categoria: 'BOLO', preco: 11.0, cozinha: false },
  { nome: 'Suco de Cajá', descricao: 'Suco natural de cajá (500ml)', categoria: 'SUCO', preco: 10.0, cozinha: false },
  { nome: 'Suco de Graviola', descricao: 'Suco natural de graviola (500ml)', categoria: 'SUCO', preco: 10.0, cozinha: false },
  { nome: 'Canjica de Milho (São João)', descricao: 'Canjica cremosa com canela — item sazonal', categoria: 'SOBREMESA', preco: 12.0, cozinha: false, sazonal: true },
];

async function main() {
  await prisma.promocao.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.consentimentoLGPD.deleteMany();
  await prisma.movimentacaoFidelidade.deleteMany();
  await prisma.fidelidade.deleteMany();
  await prisma.pagamento.deleteMany();
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.movimentacaoEstoque.deleteMany();
  await prisma.estoque.deleteMany();
  await prisma.produtoUnidade.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.unidade.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.$executeRawUnsafe('DELETE FROM sqlite_sequence');

  for (const u of usuarios) {
    const usuario = await prisma.usuario.create({
      data: {
        nome: u.nome,
        email: u.email,
        senhaHash: await bcrypt.hash(u.senha, 10),
        perfil: u.perfil,
        telefone: u.telefone,
      },
    });

    if (u.perfil === 'CLIENTE') {
      await prisma.fidelidade.create({ data: { usuarioId: usuario.id, consentimento: true } });
      await prisma.consentimentoLGPD.createMany({
        data: [
          { usuarioId: usuario.id, finalidade: 'FIDELIZACAO', consentido: true, ipOrigem: '127.0.0.1' },
          { usuarioId: usuario.id, finalidade: 'MARKETING', consentido: false, ipOrigem: '127.0.0.1' },
        ],
      });
    }
  }

  const unidadesCriadas = [];
  for (const u of unidades) {
    unidadesCriadas.push(await prisma.unidade.create({ data: u }));
  }

  for (const [i, p] of produtos.entries()) {
    const produto = await prisma.produto.create({
      data: { nome: p.nome, descricao: p.descricao, categoria: p.categoria, preco: p.preco, sazonal: p.sazonal ?? false },
    });

    for (const unidade of unidadesCriadas) {
      const disponivel = !p.cozinha || unidade.cozinhaCompleta;
      await prisma.produtoUnidade.create({ data: { produtoId: produto.id, unidadeId: unidade.id, disponivel } });
      const quantidade = !disponivel ? 0 : produto.id === 6 && unidade.id === 1 ? 2 : 50 - i * 2;
      await prisma.estoque.create({
        data: { produtoId: produto.id, unidadeId: unidade.id, quantidade, quantidadeMinima: 5 },
      });
    }
  }

  await prisma.promocao.create({
    data: {
      nome: 'São João Raízes',
      descricao: '10% de desconto em itens sazonais durante o período junino',
      desconto: 10,
      tipoDesconto: 'PERCENTUAL',
      inicioVigencia: new Date('2026-06-01T00:00:00Z'),
      fimVigencia: new Date('2026-06-30T23:59:59Z'),
    },
  });

  console.log('✅ Seed finalizado: 6 usuários, 3 unidades, 10 produtos, estoque e fidelidade.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
