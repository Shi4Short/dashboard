import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints/common";
import {
  NOTION_PERIODS,
  type Category,
  type NetworkingContact,
  type NotionEvidenceEntry,
  type NotionGoalTask,
  type NotionPeriod,
} from "./types";

// Notion shows friendlier labels than our internal category slugs.
const NOTION_CATEGORY_LABELS: Record<string, Category> = {
  Content: "content",
  "UGC Deal": "ugc",
  "Design/Portfolio": "design",
  Learning: "learning",
  Personal: "personal",
};

// The databases this app knows how to sync. Not secret (visible in the
// Notion URL) — the actual access control is the integration token below,
// which must be explicitly shared with each database in Notion.
const NETWORKING_DATABASE_ID = process.env.NOTION_NETWORKING_DATABASE_ID || "ccd2b3c993404ab3a658be9606746e7c";
const GOALS_TASKS_DATABASE_ID = process.env.NOTION_GOALS_TASKS_DATABASE_ID || "62b9c1d7c21e49319e41542f44e4aa5a";
const EVIDENCE_LOG_DATABASE_ID = process.env.NOTION_EVIDENCE_LOG_DATABASE_ID || "4234bef8761d46efa5aede7955c905f2";

let client: Client | undefined;
const dataSourceIdCache = new Map<string, string>();

function getClient(): Client {
  if (!client) {
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new Error("NOTION_TOKEN environment variable is not set");
    }
    client = new Client({ auth: token });
  }
  return client;
}

async function getDataSourceId(databaseId: string): Promise<string> {
  const cached = dataSourceIdCache.get(databaseId);
  if (cached) return cached;

  const notion = getClient();
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const dataSource = "data_sources" in database ? database.data_sources[0] : undefined;
  if (!dataSource) {
    throw new Error("Notion database has no queryable data source");
  }
  dataSourceIdCache.set(databaseId, dataSource.id);
  return dataSource.id;
}

function plainText(richText: { plain_text: string }[] | undefined): string {
  return (richText || []).map((t) => t.plain_text).join("");
}

export async function fetchNetworkingContacts(): Promise<NetworkingContact[]> {
  const notion = getClient();
  const dataSourceId = await getDataSourceId(NETWORKING_DATABASE_ID);
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });

  return response.results.filter((page): page is PageObjectResponse => "properties" in page).map((page) => {
    const props = page.properties;
    const name = props.Name?.type === "title" ? plainText(props.Name.title) : "";
    const status = props.Status?.type === "status" ? (props.Status.status?.name ?? "") : "";
    const platform = props.Platform?.type === "select" ? (props.Platform.select?.name ?? "") : "";
    const notes = props.Notes?.type === "rich_text" ? plainText(props.Notes.rich_text) : "";
    const dateContacted =
      props["Date Contacted"]?.type === "date" ? (props["Date Contacted"].date?.start ?? null) : null;

    return {
      id: page.id,
      name,
      status,
      platform,
      notes,
      dateContacted,
      url: page.url,
    };
  });
}

export async function fetchGoalsAndTasks(): Promise<NotionGoalTask[]> {
  const notion = getClient();
  const dataSourceId = await getDataSourceId(GOALS_TASKS_DATABASE_ID);
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });

  return response.results
    .filter((page): page is PageObjectResponse => "properties" in page)
    .map((page) => {
      const props = page.properties;
      const name = props.Name?.type === "title" ? plainText(props.Name.title) : "";
      const date = props.Date?.type === "date" ? (props.Date.date?.start ?? null) : null;
      const periodName = props.Period?.type === "select" ? props.Period.select?.name : undefined;
      const period = (NOTION_PERIODS as readonly string[]).includes(periodName ?? "")
        ? (periodName as NotionPeriod)
        : "";
      const notes = props.Notes?.type === "rich_text" ? plainText(props.Notes.rich_text) : "";
      const done = props.Status?.type === "status" && props.Status.status?.name === "Done";
      const projectName = props.Project?.type === "select" ? (props.Project.select?.name ?? null) : null;
      const categoryName = props.Category?.type === "select" ? props.Category.select?.name : undefined;
      const category = categoryName ? (NOTION_CATEGORY_LABELS[categoryName] ?? null) : null;

      return { id: page.id, name, date, period, notes, done, projectName, category };
    });
}

/**
 * Flips Status to Done on a Goals & Tasks row that's already there. Never
 * touches title/date/notes on that database — those stay Notion's own
 * content, which is what the "review before it touches Notion" rule is
 * actually about. A plain status flip on an existing row isn't that (and
 * per that same clarification, the Evidence Log push below isn't either —
 * it's a factual record of what happened, not authored content).
 */
export async function markGoalTaskDone(pageId: string): Promise<void> {
  const notion = getClient();
  await notion.pages.update({
    page_id: pageId,
    properties: { Status: { status: { name: "Done" } } },
  });
}

export async function fetchEvidenceEntries(): Promise<NotionEvidenceEntry[]> {
  const notion = getClient();
  const dataSourceId = await getDataSourceId(EVIDENCE_LOG_DATABASE_ID);
  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });

  return response.results
    .filter((page): page is PageObjectResponse => "properties" in page)
    .map((page) => {
      const props = page.properties;
      const text = props.Name?.type === "title" ? plainText(props.Name.title) : "";
      const date = props.Date?.type === "date" ? (props.Date.date?.start ?? null) : null;
      return { id: page.id, text, date };
    });
}

/** Creates a new page in the Evidence Log database. Returns its page ID. */
export async function pushEvidenceEntry(text: string, date: string): Promise<string> {
  const notion = getClient();
  const dataSourceId = await getDataSourceId(EVIDENCE_LOG_DATABASE_ID);
  const page = await notion.pages.create({
    parent: { data_source_id: dataSourceId },
    properties: {
      Name: { title: [{ text: { content: text } }] },
      Date: { date: { start: date } },
    },
  });
  return page.id;
}
