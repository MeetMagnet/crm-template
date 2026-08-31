const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.contact.count();
  if (existing > 0) {
    console.log("Base déjà peuplée, seed ignoré.");
    return;
  }

  const dupont = await prisma.company.create({
    data: {
      nom: "Dupont SAS",
      email: "contact@dupont-sas.fr",
      telephone: "01 42 00 00 01",
      adresse: "12 rue de la Paix, 75002 Paris",
      siteWeb: "https://dupont-sas.example",
      notes: "Client historique, renouvellement contrat Q4.",
    },
  });

  const atelier = await prisma.company.create({
    data: {
      nom: "Atelier Lumière",
      email: "hello@atelier-lumiere.fr",
      telephone: "04 78 00 00 02",
      adresse: "8 quai Saint-Antoine, 69002 Lyon",
      siteWeb: "https://atelier-lumiere.example",
    },
  });

  const technord = await prisma.company.create({
    data: {
      nom: "TechNord",
      email: "info@technord.fr",
      telephone: "03 20 00 00 03",
      adresse: "45 avenue du Capitole, 59000 Lille",
    },
  });

  const marie = await prisma.contact.create({
    data: {
      nom: "Marie Dupont",
      email: "marie.dupont@dupont-sas.fr",
      telephone: "06 12 34 56 01",
      statut: "client",
      companyId: dupont.id,
    },
  });

  const lucas = await prisma.contact.create({
    data: {
      nom: "Lucas Bernard",
      email: "lucas.bernard@atelier-lumiere.fr",
      telephone: "06 12 34 56 02",
      statut: "rdv",
      companyId: atelier.id,
    },
  });

  const sofia = await prisma.contact.create({
    data: {
      nom: "Sofia Martin",
      email: "sofia.martin@technord.fr",
      telephone: "06 12 34 56 03",
      statut: "contacte",
      companyId: technord.id,
    },
  });

  await prisma.contact.create({
    data: {
      nom: "Hugo Petit",
      email: "hugo.petit@example.fr",
      telephone: "06 12 34 56 04",
      statut: "lead",
    },
  });

  await prisma.contact.create({
    data: {
      nom: "Camille Roux",
      email: "camille.roux@example.fr",
      telephone: "06 12 34 56 05",
      statut: "perdu",
      companyId: technord.id,
    },
  });

  await prisma.action.createMany({
    data: [
      {
        contactId: marie.id,
        type: "email",
        titre: "Envoi du contrat annuel",
        contenu: "Contrat 2026 envoyé pour signature.",
        statut: "termine",
        dateRealisation: new Date(),
      },
      {
        contactId: lucas.id,
        type: "rendez_vous",
        titre: "Démo produit",
        contenu: "Présentation du module pipeline, 45 min.",
        statut: "a_faire",
        datePrevue: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        contactId: sofia.id,
        type: "appel",
        titre: "Relance commerciale",
        contenu: "Reprendre le devis envoyé la semaine dernière.",
        statut: "en_cours",
        datePrevue: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      {
        contactId: marie.id,
        type: "note",
        titre: "Préférence de contact",
        contenu: "Préfère les échanges par e-mail le mardi matin.",
        statut: "termine",
        dateRealisation: new Date(),
      },
    ],
  });

  console.log("Données de démo créées.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
