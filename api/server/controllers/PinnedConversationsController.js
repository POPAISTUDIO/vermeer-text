const { updateUser, getUserById } = require('~/models');

// Vermeer: épinglage de conversations — miroir strict du pattern favorites
// (FavoritesController). Liste user-scopée d'ids de conversations, stockée sur le
// User ; le POST remplace la liste. Le schéma Conversation reste intouché.
const MAX_PINNED = 100;
const MAX_ID_LENGTH = 256;

const updatePinnedConversationsController = async (req, res) => {
  try {
    const { pinnedConversations } = req.body;
    const userId = req.user.id;

    if (!pinnedConversations) {
      return res.status(400).json({ message: 'Pinned conversations data is required' });
    }

    if (!Array.isArray(pinnedConversations)) {
      return res.status(400).json({ message: 'Pinned conversations must be an array' });
    }

    if (pinnedConversations.length > MAX_PINNED) {
      return res.status(400).json({
        code: 'MAX_PINNED_EXCEEDED',
        message: `Maximum ${MAX_PINNED} pinned conversations allowed`,
        limit: MAX_PINNED,
      });
    }

    for (const id of pinnedConversations) {
      if (typeof id !== 'string' || id.length === 0) {
        return res
          .status(400)
          .json({ message: 'Each pinned conversation must be a non-empty string' });
      }
      if (id.length > MAX_ID_LENGTH) {
        return res
          .status(400)
          .json({ message: `conversationId exceeds maximum length of ${MAX_ID_LENGTH}` });
      }
    }

    const user = await updateUser(userId, { pinnedConversations });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(user.pinnedConversations);
  } catch (error) {
    console.error('Error updating pinned conversations:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getPinnedConversationsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await getUserById(userId, 'pinnedConversations');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let pinnedConversations = user.pinnedConversations || [];

    if (!Array.isArray(pinnedConversations)) {
      pinnedConversations = [];
      await updateUser(userId, { pinnedConversations: [] });
    }

    return res.status(200).json(pinnedConversations);
  } catch (error) {
    console.error('Error fetching pinned conversations:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  updatePinnedConversationsController,
  getPinnedConversationsController,
};
