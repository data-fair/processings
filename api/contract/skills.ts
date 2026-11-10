/**
 * The skill bodies of the API document's `x-agent.skills`: markdown files in ./skills, served at
 * /processings/api/v1/agents/skills/<name>.md and linked by `href` (relative to the document URL,
 * /processings/api/v1/api-docs.json). Read once: they ship with the code.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const dir = path.join(import.meta.dirname, 'skills')
const skills = new Map(readdirSync(dir)
  .filter(file => file.endsWith('.md'))
  .map(file => [file.slice(0, -3), readFileSync(path.join(dir, file), 'utf8')]))

/** The markdown body of a skill, or undefined for a name that is not one of the files. */
export const readAgentSkill = (name: string): string | undefined => skills.get(name)
