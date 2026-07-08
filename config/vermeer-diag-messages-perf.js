/**
 * vermeer-diag-messages-perf.js — diagnostic READ-ONLY de la perf de chargement d'une conversation.
 *
 * CONTEXTE
 *   Symptôme prod (v0.10.10) : ouvrir une conversation existante = 1 à 5 min de chargement.
 *   Le chemin backend charge TOUS les messages d'un coup :
 *     GET /api/messages/:conversationId
 *       -> Message.find({ conversationId }).sort({ createdAt: 1 }).lean()   (aucune pagination)
 *   Hypothèse n°1 : l'index `conversationId` (déclaré dans le schéma) n'est pas réellement
 *   CONSTRUIT dans le Mongo de prod (autoIndex off / collection migrée) -> COLLSCAN de toute
 *   la collection messages à chaque ouverture. Ce script le confirme ou l'infirme.
 *
 * CE QUE FAIT LE SCRIPT (aucune écriture — que des lectures)
 *   1. db.messages.getIndexes()                     -> liste complète des index réellement présents
 *   2. db.messages.countDocuments()                 -> taille de la collection
 *   3. Top 10 conversations par nombre de messages  -> repérer les convs "monstres"
 *   4. explain("executionStats") sur
 *        find({ conversationId: <la plus grosse> }).sort({ createdAt: 1 })
 *                                                    -> COLLSCAN vs IXSCAN + executionTimeMillis
 *
 * PRÉREQUIS
 *   - Variable d'env MONGO_URI (pointer sur un réplica read-only de PROD de préférence).
 *   - Script STANDALONE : aucun import de l'app, aucune dépendance aux schémas. Non déployé.
 *   - Aucune donnée sensible affichée : IDs tronqués, aucun contenu de message, aucun email.
 *
 * USAGE
 *   MONGO_URI="mongodb+srv://...readonly..." node config/vermeer-diag-messages-perf.js
 *   MONGO_URI="mongodb+srv://...readonly..." node config/vermeer-diag-messages-perf.js --conversationId <id>
 *
 *   Sans argument : explain sur la plus grosse conversation (top-10 automatique).
 *   Avec --conversationId <id> : explain AUSSI sur cette conversation précise (ex. celle
 *   d'un utilisateur qui rapporte la lenteur), en plus du top-10.
 */

const { MongoClient } = require('mongodb');

const c = {
  title: (m) => console.log('\x1b[35m%s\x1b[0m', m),
  ok: (m) => console.log('\x1b[32m%s\x1b[0m', m),
  warn: (m) => console.log('\x1b[33m%s\x1b[0m', m),
  err: (m) => console.log('\x1b[31m%s\x1b[0m', m),
  info: (m) => console.log('\x1b[36m%s\x1b[0m', m),
  gray: (m) => console.log('\x1b[90m%s\x1b[0m', m),
};

function truncateId(id) {
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}

/** Lit --conversationId <id> dans argv (renvoie null si absent). */
function parseConversationIdArg() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--conversationId');
  if (idx === -1) {
    return null;
  }
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) {
    c.err('ERREUR : --conversationId doit être suivi d\'un identifiant. Abandon.');
    process.exit(1);
  }
  return value;
}

/** Descend récursivement dans un plan d'exécution et collecte les stages (COLLSCAN, IXSCAN, SORT…). */
function collectStages(plan, acc = []) {
  if (!plan || typeof plan !== 'object') {
    return acc;
  }
  if (plan.stage) {
    acc.push({ stage: plan.stage, indexName: plan.indexName });
  }
  if (plan.inputStage) {
    collectStages(plan.inputStage, acc);
  }
  if (Array.isArray(plan.inputStages)) {
    for (const s of plan.inputStages) {
      collectStages(s, acc);
    }
  }
  return acc;
}

/**
 * Lance explain("executionStats") sur find({conversationId}).sort({createdAt:1})
 * et affiche le plan (COLLSCAN vs IXSCAN) + les stats. Lecture seule.
 */
async function explainConversation(messages, conversationId, label) {
  c.info(`\n[explain] ${label}`);
  c.gray(`    conversationId = ${truncateId(conversationId)}`);

  const explain = await messages
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .explain('executionStats');

  const winningPlan = explain.queryPlanner && explain.queryPlanner.winningPlan;
  const stages = collectStages(winningPlan);
  const stageNames = stages.map((s) => s.stage);
  const usedIndex = stages.find((s) => s.stage === 'IXSCAN');
  const isCollScan = stageNames.includes('COLLSCAN');

  const stats = explain.executionStats || {};
  console.table([
    {
      plan: stageNames.join(' <- ') || '(inconnu)',
      index: usedIndex ? usedIndex.indexName : '(aucun)',
      executionTimeMillis: stats.executionTimeMillis,
      nReturned: stats.nReturned,
      totalKeysExamined: stats.totalKeysExamined,
      totalDocsExamined: stats.totalDocsExamined,
    },
  ]);

  if (isCollScan) {
    c.err(
      `  /!\\ COLLSCAN — la requête scanne ${
        (stats.totalDocsExamined || 0).toLocaleString('en-US')
      } documents pour en renvoyer ${stats.nReturned}. C'EST LA CAUSE DU 1-5 MIN.`,
    );
    c.err('      Fix : créer l\'index -> db.messages.createIndex({ conversationId: 1, createdAt: 1 })');
    return;
  }
  if (usedIndex) {
    c.ok(`  IXSCAN via l'index "${usedIndex.indexName}" — la requête est indexée.`);
    if (stageNames.includes('SORT')) {
      c.warn('      NB : stage SORT présent -> tri en mémoire (pas de composé). Généralement négligeable pour une conv.');
    }
    if ((stats.executionTimeMillis || 0) > 1000) {
      c.warn(`      Mais executionTimeMillis = ${stats.executionTimeMillis} ms -> creuser la taille du payload / le rendu front.`);
    }
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    c.err("ERREUR : variable d'env MONGO_URI absente. Exporter un URI (réplica read-only) et relancer.");
    process.exit(1);
  }

  const targetConversationId = parseConversationIdArg();

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db();
    const messages = db.collection('messages');

    c.title('==================================================');
    c.title(`Diagnostic perf messages — base : ${db.databaseName}`);
    c.title('READ-ONLY — aucune écriture effectuée');
    if (targetConversationId) {
      c.title(`Cible explicite : --conversationId ${truncateId(targetConversationId)}`);
    }
    c.title('==================================================');

    // ---- 1. Index réellement présents ----------------------------------------
    c.info('\n[1] db.messages.getIndexes() — index réellement construits en base');
    const indexes = await messages.indexes();
    console.table(
      indexes.map((idx) => ({
        name: idx.name,
        key: JSON.stringify(idx.key),
        unique: !!idx.unique,
        ttl: idx.expireAfterSeconds !== undefined ? `${idx.expireAfterSeconds}s` : '',
      })),
    );
    const hasConvIdIndex = indexes.some((idx) => idx.key && idx.key.conversationId !== undefined);
    const hasCompound = indexes.some(
      (idx) => idx.key && idx.key.conversationId !== undefined && idx.key.createdAt !== undefined,
    );
    if (!hasConvIdIndex) {
      c.err('  /!\\ AUCUN index sur conversationId -> chaque ouverture de conv = COLLSCAN complet. CAUSE PROBABLE.');
    } else if (!hasCompound) {
      c.warn('  Index conversationId présent, mais PAS de composé {conversationId, createdAt} (tri en mémoire).');
    } else {
      c.ok('  Index composé {conversationId, createdAt} présent — chemin optimal côté index.');
    }

    // ---- 2. Taille de la collection ------------------------------------------
    c.info('\n[2] Taille de la collection messages');
    const totalMessages = await messages.estimatedDocumentCount();
    c.gray(`  db.messages (estimé) : ${totalMessages.toLocaleString('en-US')} documents`);
    c.gray('  (un COLLSCAN ne fait mal qu\'à grande échelle — ce chiffre calibre la gravité)');

    // ---- 3. Top 10 conversations par nombre de messages ----------------------
    c.info('\n[3] Top 10 conversations par nombre de messages (repérer les convs monstres)');
    const top = await messages
      .aggregate(
        [
          { $group: { _id: '$conversationId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ],
        { allowDiskUse: true },
      )
      .toArray();

    if (top.length === 0) {
      c.warn('  Aucune conversation trouvée — vérifier que MONGO_URI pointe la bonne base.');
    } else {
      console.table(
        top.map((r, i) => ({
          rank: i + 1,
          conversationId: truncateId(r._id),
          messages: r.count,
        })),
      );
    }

    // ---- 4. explain() sur la plus grosse conversation ------------------------
    c.info('\n[4] explain("executionStats") sur find({ conversationId }).sort({ createdAt: 1 })');
    if (top.length > 0) {
      await explainConversation(
        messages,
        top[0]._id,
        `plus grosse conversation (${top[0].count} messages)`,
      );
    }

    // ---- 4b. explain() sur une conversation ciblée (--conversationId) --------
    if (targetConversationId) {
      const targetCount = await messages.countDocuments({ conversationId: targetConversationId });
      if (targetCount === 0) {
        c.warn(`\n[4b] --conversationId ${truncateId(targetConversationId)} : aucun message trouvé (id inexistant dans cette base ?).`);
      } else {
        await explainConversation(
          messages,
          targetConversationId,
          `conversation ciblée --conversationId (${targetCount} messages)`,
        );
      }
    }

    c.ok('\nTerminé (aucune écriture effectuée).');
  } finally {
    await client.close();
  }
}

main().catch(async (err) => {
  c.err('ERREUR : ' + (err && err.message ? err.message : err));
  console.error(err);
  process.exit(1);
});
