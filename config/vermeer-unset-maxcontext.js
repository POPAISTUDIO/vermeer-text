/**
 * vermeer-unset-maxcontext.js — purge du champ `maxContextTokens` pollué sur les conversations.
 *
 * CONTEXTE
 *   Un bug (corrigé par le fix v0.10.15 + garde anti-écho fix/max-context-echo) a figé la valeur
 *   système calculée (~68400) dans `conversations.maxContextTokens` dès le 1er message, puis l'a
 *   propagée par écho (rechargement DB + héritage LAST_CONVO_SETUP). Ce script purge le STOCK
 *   déjà pollué en base — le code ne "désécrit" pas un champ déjà persisté.
 *
 * ⚠️ AVERTISSEMENT
 *   Le `$unset` retire `maxContextTokens` de TOUTES les conversations qui en ont un, y compris les
 *   (rares) valeurs réglées volontairement par un utilisateur. C'est assumé : un utilisateur peut
 *   re-régler son plafond ensuite. Le mode --dry-run liste la distribution des valeurs pour repérer
 *   les "autres" (≠ 68400 = saisies potentiellement volontaires) AVANT d'appliquer.
 *
 * PRÉREQUIS
 *   - Variable d'env MONGO_URI (ex. mongodb://127.0.0.1:27017/LibreChat).
 *   - Lancer D'ABORD en dry-run (défaut), relire la distribution, puis --apply.
 *   - Script STANDALONE : aucun import de l'app, aucune dépendance aux schémas. Non déployé.
 *
 * USAGE
 *   MONGO_URI="mongodb://..." node config/vermeer-unset-maxcontext.js              # dry-run (défaut)
 *   MONGO_URI="mongodb://..." node config/vermeer-unset-maxcontext.js --dry-run    # explicite
 *   MONGO_URI="mongodb://..." node config/vermeer-unset-maxcontext.js --apply      # demande confirmation
 *   MONGO_URI="mongodb://..." node config/vermeer-unset-maxcontext.js --apply --yes # sans confirmation (ops/CI)
 */

const readline = require('readline');
const { MongoClient } = require('mongodb');

const SYSTEM_VALUE = 68400; // valeur système la plus fréquemment figée (repère de distribution)
const FILTER = { maxContextTokens: { $exists: true, $ne: null } };

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const YES = args.includes('--yes');
const DRY_RUN = !APPLY; // dry-run par défaut, y compris si --dry-run est passé explicitement

function truncateId(id) {
  const s = String(id);
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

async function confirm(question) {
  if (YES) {
    return true;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return answer.trim().toLowerCase() === 'yes' || answer.trim().toLowerCase() === 'y';
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("ERREUR : variable d'env MONGO_URI absente. Abandon.");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db();
    const conversations = db.collection('conversations');

    const total = await conversations.countDocuments(FILTER);
    console.log(`\n=== vermeer-unset-maxcontext — mode ${DRY_RUN ? 'DRY-RUN' : 'APPLY'} ===`);
    console.log(`Conversations avec maxContextTokens défini : ${total}`);

    if (total === 0) {
      console.log('Rien à faire.');
      return;
    }

    // Distribution des valeurs (combien à SYSTEM_VALUE, combien "autres").
    const distribution = await conversations
      .aggregate([
        { $match: FILTER },
        { $group: { _id: '$maxContextTokens', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const systemBucket = distribution.find((d) => d._id === SYSTEM_VALUE);
    const others = distribution.filter((d) => d._id !== SYSTEM_VALUE);
    const othersTotal = others.reduce((acc, d) => acc + d.count, 0);

    console.log(`\nDistribution des valeurs :`);
    console.log(
      `  - ${SYSTEM_VALUE} (valeur système figée) : ${systemBucket ? systemBucket.count : 0}`,
    );
    console.log(`  - autres (${othersTotal}) — saisies potentiellement volontaires :`);
    for (const d of others) {
      console.log(`      ${d._id} : ${d.count}`);
    }

    // 10 exemples (id tronqué, valeur, updatedAt).
    const samples = await conversations
      .find(FILTER, { projection: { conversationId: 1, maxContextTokens: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .toArray();

    console.log(`\n10 exemples (les plus récents) :`);
    for (const s of samples) {
      console.log(
        `  ${truncateId(s.conversationId)}  maxContextTokens=${s.maxContextTokens}  updatedAt=${
          s.updatedAt ? new Date(s.updatedAt).toISOString() : 'n/a'
        }`,
      );
    }

    if (DRY_RUN) {
      console.log(
        `\nDRY-RUN : aucune écriture. Relire la distribution ci-dessus, puis relancer avec --apply.`,
      );
      return;
    }

    console.log(
      `\n⚠️ APPLY va exécuter : updateMany(${JSON.stringify(FILTER)}, { $unset: { maxContextTokens: "" } })`,
    );
    console.log(
      `   -> ${total} conversations affectées (dont ${othersTotal} valeurs "autres" possiblement volontaires).`,
    );
    const ok = await confirm('Confirmer la purge ? Tapez "yes" pour continuer : ');
    if (!ok) {
      console.log('Annulé. Aucune écriture.');
      return;
    }

    const res = await conversations.updateMany(FILTER, { $unset: { maxContextTokens: '' } });
    console.log(`\nTerminé. Conversations modifiées : ${res.modifiedCount}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('ERREUR :', err);
  process.exit(1);
});
