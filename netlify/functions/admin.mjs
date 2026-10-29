import { getSession } from '../lib/auth.mjs';
import { fail, json, readJson, isTrustedMutation } from '../lib/http.mjs';
import { 
  readTable, 
  appendRecord, 
  updateRecord, 
  deleteRecord, 
  getRecord, 
  listTables,
  exportTable,
  getStats 
} from '../lib/file-db.mjs';

async function handleAdmin(req, context) {
  const session = getSession(req);
  
  // Check authentication
  if (!session) {
    return fail(401, 'Authentication required. Please log in.');
  }

  const action = context.params?.action;
  const table = context.params?.table;
  const id = context.params?.id;

  // GET endpoints
  if (req.method === 'GET') {
    if (action === 'tables') {
      const tables = await listTables();
      return json({ tables });
    }

    if (action === 'stats') {
      const stats = await getStats();
      return json({ stats });
    }

    if (table && action === 'table') {
      const records = await readTable(table);
      return json({ table, records, count: records.length });
    }

    if (table && id && action === 'record') {
      const record = await getRecord(table, id);
      if (!record) {
        return fail(404, `Record ${id} not found in table ${table}`);
      }
      return json({ record });
    }

    if (table && action === 'export') {
      const data = await exportTable(table);
      return json(data);
    }

    return fail(404, 'Endpoint not found');
  }

  // Mutation requests must come from trusted source
  if (!isTrustedMutation(req)) {
    return fail(403, 'Forbidden');
  }

  // POST endpoint - create record
  if (req.method === 'POST' && action === 'record' && table) {
    const body = await readJson(req);
    
    // Remove system fields from input
    delete body._id;
    delete body._created;
    delete body._updated;

    const record = await appendRecord(table, body);
    return json({ success: true, record }, 201);
  }

  // PATCH endpoint - update record
  if (req.method === 'PATCH' && action === 'record' && table && id) {
    const body = await readJson(req);
    
    // Remove system fields from input
    delete body._id;
    delete body._created;

    const record = await updateRecord(table, id, body);
    return json({ success: true, record });
  }

  // DELETE endpoint - delete record
  if (req.method === 'DELETE' && action === 'record' && table && id) {
    const deleted = await deleteRecord(table, id);
    return json({ success: true, deleted });
  }

  return fail(405, 'Method not allowed');
}

export default async (req, context) => {
  try {
    return await handleAdmin(req, context);
  } catch (error) {
    console.error('Admin API error:', error);
    return fail(500, `Error: ${error.message}`);
  }
};

export const config = {
  path: [
    '/api/admin/:action',
    '/api/admin/:action/:table',
    '/api/admin/:action/:table/:id'
  ]
};
