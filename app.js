const express = require('express');
const taskRoutes = require('./routes/taskRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.get('/health', (_req, res) => res.status(200).json({ data: { status: 'ok' } }));
app.use('/api/v1/tasks', taskRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
