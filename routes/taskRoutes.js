const express = require('express');
const controller = require('../controllers/taskController');

const router = express.Router();
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.patch('/:id/status', controller.updateStatus);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
