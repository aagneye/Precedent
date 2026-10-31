import type { Settings } from '../config/settings';
import { getPage, listPageIds } from '../integrations/confluence';
import { getComment, getComments, issueUrl, searchIssueKeys } from '../integrations/jira';
import type { HarvestJob } from './jobs';
import { looksLikeDecision, type HarvestItem } from './pipeline';

const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,19}$/;
const PAGES_PER_SPACE = 25;
const ISSUES_PER_SCAN = 30;
const COMMENTS_PER_ISSUE = 20;

export function scannedProjects(settings: Settings): string[] {
  const keys = new Set(settings.jiraProjectKeys);
  if (settings.demo?.projectKey) keys.add(settings.demo.projectKey);
  return [...keys].filter((key) => PROJECT_KEY.test(key));
}

export function scannedSpaces(settings: Settings): string[] {
  const ids = new Set(settings.confluenceSpaceIds);
  if (settings.demo?.spaceId) ids.add(settings.demo.spaceId);
  return [...ids];
}

export async function pageItem(pageId: string): Promise<{ item: HarvestItem; spaceId: string } | undefined> {
  const page = await getPage(pageId);
  if (!page) return undefined;
  return {
    spaceId: page.spaceId,
    item: {
      kind: 'confluence_page',
      ref: page.id,
      url: page.url,
      title: page.title,
      text: page.text,
      authorAccountId: page.authorAccountId,
      createdAt: page.createdAt,
    },
  };
}

export async function commentItem(issueKey: string, commentId: string): Promise<HarvestItem | undefined> {
  const comment = await getComment(issueKey, commentId);
  if (!comment) return undefined;
  return {
    kind: 'jira_comment',
    ref: `${issueKey}/${comment.id}`,
    url: `${await issueUrl(issueKey)}?focusedCommentId=${comment.id}`,
    title: `Comment on ${issueKey}`,
    text: comment.text,
    authorAccountId: comment.authorAccountId,
    createdAt: comment.created,
    projectKey: issueKey.split('-')[0],
    linkedIssueKey: issueKey,
  };
}

/** Jobs for every recent page in the scanned spaces and every decision-like comment in the scanned projects. */
export async function scanJobs(settings: Settings): Promise<HarvestJob[]> {
  const jobs: HarvestJob[] = [];
  for (const spaceId of scannedSpaces(settings)) {
    for (const pageId of await listPageIds(spaceId, PAGES_PER_SPACE)) jobs.push({ type: 'page', pageId });
  }
  const projects = scannedProjects(settings);
  if (projects.length) {
    const jql = `project in (${projects.join(', ')}) AND updated >= -30d ORDER BY updated DESC`;
    for (const issueKey of await searchIssueKeys(jql, ISSUES_PER_SCAN)) {
      for (const comment of await getComments(issueKey, COMMENTS_PER_ISSUE)) {
        if (looksLikeDecision(comment.text)) jobs.push({ type: 'comment', issueKey, commentId: comment.id });
      }
    }
  }
  return jobs;
}
