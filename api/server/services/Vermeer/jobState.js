// Vermeer: marqueur d'idempotence pour les jobs planifiés Vermeer (isolé du natif).
// Modèle dédié, non enregistré dans le registry natif createModels de data-schemas.
const mongoose = require('mongoose');

// Vermeer: schéma marqueur — un doc par job (_id = clé du job), collection dédiée.
const vermeerJobStateSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    lastResetMonth: { type: String },
    updatedAt: { type: Date },
  },
  { collection: 'vermeer_job_state', versionKey: false },
);

// Vermeer: guard identique à l'idiome repo (mongoose.models.X || mongoose.model(...)).
const VermeerJobState =
  mongoose.models.VermeerJobState ||
  mongoose.model('VermeerJobState', vermeerJobStateSchema);

module.exports = VermeerJobState;
