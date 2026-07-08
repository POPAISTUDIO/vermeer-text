const express = require('express');
const {
  updateFavoritesController,
  getFavoritesController,
} = require('~/server/controllers/FavoritesController');
// Vermeer: épinglage de conversations (miroir favorites)
const {
  updatePinnedConversationsController,
  getPinnedConversationsController,
} = require('~/server/controllers/PinnedConversationsController');
const {
  getSkillStatesController,
  updateSkillStatesController,
} = require('~/server/controllers/SkillStatesController');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

router.get('/favorites', requireJwtAuth, getFavoritesController);
router.post('/favorites', requireJwtAuth, updateFavoritesController);
// Vermeer: GET+POST /api/user/settings/pinned-conversations
router.get('/pinned-conversations', requireJwtAuth, getPinnedConversationsController);
router.post('/pinned-conversations', requireJwtAuth, updatePinnedConversationsController);
router.get('/skills/active', requireJwtAuth, getSkillStatesController);
router.post('/skills/active', requireJwtAuth, updateSkillStatesController);

module.exports = router;
