import { Hono } from "hono";
import {
	clonePersona,
	deletePersona,
	getAllPersonas,
	getPersonaByKey,
	injectInstruction,
	updatePersona,
	type PersonaUpdate,
} from "../../../components/persona-trainer";
import { interrogatePersona } from "../../../components/persona-trainer/interrogate";

const PERSONA_NOT_FOUND = "Persona not found";

const personas = new Hono();

// GET /api/personas
personas.get("/", async (c) => {
	const records = await getAllPersonas();
	return c.json(records);
});

// GET /api/personas/:key
personas.get("/:key", async (c) => {
	const key = c.req.param("key");
	const record = await getPersonaByKey(key);
	if (!record) return c.json({ error: PERSONA_NOT_FOUND }, 404);
	return c.json(record);
});

// PUT /api/personas/:key
personas.put("/:key", async (c) => {
	const key = c.req.param("key");
	const body = await c.req.json<PersonaUpdate>();

	const updated = await updatePersona(key, body);
	if (!updated) return c.json({ error: PERSONA_NOT_FOUND }, 404);
	return c.json(updated);
});

// POST /api/personas/:key/clone
personas.post("/:key/clone", async (c) => {
	const sourceKey = c.req.param("key");
	const body = await c.req.json<{ newKey?: string; name?: string; role?: string }>();

	const { newKey, name, role } = body;

	if (!newKey) return c.json({ error: "newKey is required" }, 400);
	if (!/^[a-z0-9_-]+$/.test(newKey)) {
		return c.json(
			{ error: "newKey must contain only lowercase alphanumeric characters, underscores, or hyphens" },
			400,
		);
	}
	if (!name || name.trim() === "") return c.json({ error: "name is required" }, 400);
	if (!role) return c.json({ error: "role is required" }, 400);

	const existing = await getPersonaByKey(newKey);
	if (existing) {
		return c.json({ error: "A persona with that key already exists" }, 409);
	}

	const cloned = await clonePersona(sourceKey, newKey, name.trim(), role);
	if (!cloned) return c.json({ error: "Source persona not found" }, 404);

	return c.json(cloned, 201);
});

// DELETE /api/personas/:key
personas.delete("/:key", async (c) => {
	const key = c.req.param("key");

	const record = await getPersonaByKey(key);
	if (!record) return c.json({ error: PERSONA_NOT_FOUND }, 404);

	if (record.isBuiltIn) return c.json({ error: "Built-in personas cannot be deleted — deactivate them instead" }, 403);
	await deletePersona(key);
	return c.json({ success: true });
});

// POST /api/personas/:key/interrogate
personas.post("/:key/interrogate", async (c) => {
	const key = c.req.param("key");
	const body = await c.req.json<{ question?: string }>();
	const question = body.question?.trim();
	if (!question) return c.json({ error: "question is required" }, 400);

	const record = await getPersonaByKey(key);
	if (!record) return c.json({ error: PERSONA_NOT_FOUND }, 404);

	const response = await interrogatePersona(record, question);
	return c.json({ response, personaName: record.name });
});

// POST /api/personas/:key/inject
personas.post("/:key/inject", async (c) => {
	const key = c.req.param("key");
	const body = await c.req.json<{ instruction?: string }>();
	const instruction = body.instruction?.trim();
	if (!instruction) return c.json({ error: "instruction is required" }, 400);

	const updated = await injectInstruction(key, instruction);
	if (!updated) return c.json({ error: PERSONA_NOT_FOUND }, 404);
	return c.json(updated);
});

export default personas;
