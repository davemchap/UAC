import { Hono } from "hono";
import { getAllPersonas, getPersonaByKey, injectInstruction, updatePersona } from "../../../components/persona-trainer";
import { interrogatePersona } from "../../../components/persona-trainer/interrogate";

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
	if (!record) return c.json({ error: "Persona not found" }, 404);
	return c.json(record);
});

// PUT /api/personas/:key
personas.put("/:key", async (c) => {
	const key = c.req.param("key");
	const body = await c.req.json<{
		name?: string;
		role?: string;
		color?: string;
		literacyLevel?: string;
		unknownTerms?: string[];
		maxSentenceLength?: number;
		maxGradeLevel?: number;
		successCriteria?: string;
		behavioralContext?: string | null;
	}>();

	const updated = await updatePersona(key, body);
	if (!updated) return c.json({ error: "Persona not found" }, 404);
	return c.json(updated);
});

// POST /api/personas/:key/interrogate
personas.post("/:key/interrogate", async (c) => {
	const key = c.req.param("key");
	const body = await c.req.json<{ question?: string }>();
	const question = body.question?.trim();
	if (!question) return c.json({ error: "question is required" }, 400);

	const record = await getPersonaByKey(key);
	if (!record) return c.json({ error: "Persona not found" }, 404);

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
	if (!updated) return c.json({ error: "Persona not found" }, 404);
	return c.json(updated);
});

export default personas;
