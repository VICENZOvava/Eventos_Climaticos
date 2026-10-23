const prisma = require('../src/data/prisma')

async function main() {
    await prisma.$transaction(async (transaction) => {
        await transaction.evento.deleteMany()
        await transaction.usuario.deleteMany()

        const usuarios = await Promise.all([
            transaction.usuario.create({ data: { nome: "Ana Silva", email: "ana@email.com", senha: "senha123" } }),
            transaction.usuario.create({ data: { nome: "Maria Silva", email: "maria@email.com", senha: "senha123" } }),
            transaction.usuario.create({ data: { nome: "João Oliveira", email: "joao@email.com", senha: "senha123" } }),
            transaction.usuario.create({ data: { nome: "Paula Martins", email: "paula@email.com", senha: "senha123" } }),
            transaction.usuario.create({ data: { nome: "Pedro Souza", email: "pedro@email.com", senha: "senha123" } })
        ])
        console.log("Usuarios de teste cadastrados.")
        const eventos = await Promise.all([
            transaction.evento.create({ data: { usuarioId: 1, cidade: "Amparo", tipoEvento: "Tempestade", temperaturaMaxima: 34.2, nivelImpacto: "Derrubada de árvores e destelhamento de edifícios" } }),
            transaction.evento.create({ data: { usuarioId: 1, cidade: "Campinas", tipoEvento: "Queimada", temperaturaMaxima: 38.2, nivelImpacto: "Perda de mata atlântica e área agrícola" } }),
            transaction.evento.create({ data: { usuarioId: 2, cidade: "Jaguariúna", tipoEvento: "Tempestade Magnética", temperaturaMaxima: 30.1, nivelImpacto: "Acidentes com pessoas atingidas por raios" } }),
            transaction.evento.create({ data: { usuarioId: 2, cidade: "Pedreira", tipoEvento: "Tempestade", temperaturaMaxima: 34.2, nivelImpacto: "Derrubada de árvores e destelhamento de edifícios" } }),
            transaction.evento.create({ data: { usuarioId: 3, cidade: "Monte Alegre do Sul", tipoEvento: "Vendaval", temperaturaMaxima: 36.2, nivelImpacto: "Derrubada de árvores e destelhamento de edifícios" } }),
            transaction.evento.create({ data: { usuarioId: 3, cidade: "Santo Antônio de Posse", tipoEvento: "Baixa umidade relativa do ar", temperaturaMaxima: 39.7, nivelImpacto: "Excesso de atendimento a pessoas com problemas respiratórios" } }),
            transaction.evento.create({ data: { usuarioId: 4, cidade: "Serra Negra", tipoEvento: "Geada", temperaturaMaxima: 6.2, nivelImpacto: "Perda de produção agrícola" } }),
            transaction.evento.create({ data: { usuarioId: 5, cidade: "Águas de Lindóia", tipoEvento: "Tempestade", temperaturaMaxima: 34.8, nivelImpacto: "Derrubada de árvores e destelhamento de edifícios" } })
        ])
        console.log("Eventos de teste cadastrados.")
    })
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })