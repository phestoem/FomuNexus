"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatSubmissionDate } from "@/lib/nexus/display-utils";
import styles from "./blueprints-list.module.css";

type FormSummary = {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  isArchived: boolean;
  submissionCount: number;
  sessionCount: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ListStatus = "active" | "archived" | "all";
type ListSort = "updated_desc" | "updated_asc" | "name_asc" | "name_desc";

type StartSessionResponse = {
  sessionId: string;
  label: string;
  url: string;
};

const PAGE_SIZE = 20;

function buildListUrl(params: {
  q: string;
  page: number;
  status: ListStatus;
  sort: ListSort;
}) {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("limit", String(PAGE_SIZE));
  search.set("status", params.status);
  search.set("sort", params.sort);
  if (params.q.trim()) {
    search.set("q", params.q.trim());
  }
  return `/api/nexus/blueprints?${search.toString()}`;
}

export function BlueprintsList() {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListStatus>("active");
  const [sort, setSort] = useState<ListSort>("updated_desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyBlueprintId, setBusyBlueprintId] = useState<string | null>(null);
  const [copiedBlueprintId, setCopiedBlueprintId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    ids: string[];
    label: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadForms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        buildListUrl({ q: searchQuery, page, status: statusFilter, sort }),
      );

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error ?? "Failed to load forms.");
      }

      const payload = (await response.json()) as {
        forms: FormSummary[];
        pagination: Pagination;
      };

      setForms(payload.forms);
      setPagination(payload.pagination);
      setSelectedIds(new Set());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load forms.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, sort, statusFilter]);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  const allOnPageSelected = useMemo(
    () => forms.length > 0 && forms.every((form) => selectedIds.has(form.id)),
    [forms, selectedIds],
  );

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(forms.map((form) => form.id)));
  }

  function toggleSelected(formId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(formId)) {
        next.delete(formId);
      } else {
        next.add(formId);
      }
      return next;
    });
  }

  async function handleStartSession(
    blueprintId: string,
    mode: "open" | "copy",
  ) {
    setBusyBlueprintId(blueprintId);
    setCopiedBlueprintId(null);
    setError(null);

    try {
      const response = await fetch("/api/nexus/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error ?? "Failed to create a form link.");
      }

      const payload = (await response.json()) as StartSessionResponse;

      if (mode === "copy") {
        await navigator.clipboard.writeText(payload.url);
        setCopiedBlueprintId(blueprintId);
      } else {
        window.open(payload.url, "_blank", "noopener,noreferrer");
      }
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Failed to create a form link.",
      );
    } finally {
      setBusyBlueprintId(null);
    }
  }

  async function patchBlueprint(formId: string, archived: boolean) {
    setBusyBlueprintId(formId);
    setError(null);

    try {
      const response = await fetch(`/api/nexus/blueprints/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error ?? "Failed to update form.");
      }

      await loadForms();
    } catch (patchError) {
      setError(
        patchError instanceof Error
          ? patchError.message
          : "Failed to update form.",
      );
    } finally {
      setBusyBlueprintId(null);
    }
  }

  async function runBulkAction(
    action: "archive" | "restore" | "delete",
    ids: string[],
  ) {
    setManaging(true);
    setError(null);

    try {
      const response = await fetch("/api/nexus/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, blueprintIds: ids }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error ?? "Failed to update forms.");
      }

      setConfirmDelete(null);
      await loadForms();
    } catch (bulkError) {
      setError(
        bulkError instanceof Error
          ? bulkError.message
          : "Failed to update forms.",
      );
    } finally {
      setManaging(false);
    }
  }

  async function deleteBlueprint(formId: string) {
    setBusyBlueprintId(formId);
    setError(null);

    try {
      const response = await fetch(`/api/nexus/blueprints/${formId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error ?? "Failed to delete form.");
      }

      setConfirmDelete(null);
      await loadForms();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete form.",
      );
    } finally {
      setBusyBlueprintId(null);
    }
  }

  const selectedCount = selectedIds.size;
  const showBulkBar = selectedCount > 0;
  const rangeStart =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeEnd = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Creator Dashboard</p>
            <h1 className={styles.title}>Manage forms</h1>
            <p className={styles.subtitle}>
              Search, archive, and remove production blueprints. Archived forms
              stay in the database but are hidden from the default list and
              cannot receive new intake links.
            </p>
          </div>
          <Link href="/admin/new" className={styles.createButton}>
            Create new form
          </Link>
        </header>

        <section className={styles.toolbar}>
          <label className={styles.searchField}>
            <span className={styles.searchLabel}>Search forms</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by title..."
              className={styles.searchInput}
            />
          </label>

          <div className={styles.toolbarRow}>
            <div className={styles.filterGroup} role="tablist" aria-label="Form status">
              {(
                [
                  ["active", "Active"],
                  ["archived", "Archived"],
                  ["all", "All"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === value}
                  className={
                    statusFilter === value
                      ? `${styles.filterButton} ${styles.filterButtonActive}`
                      : styles.filterButton
                  }
                  onClick={() => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className={styles.sortField}>
              <span className={styles.sortLabel}>Sort</span>
              <select
                value={sort}
                className={styles.sortSelect}
                onChange={(event) => {
                  setSort(event.target.value as ListSort);
                  setPage(1);
                }}
              >
                <option value="updated_desc">Recently updated</option>
                <option value="updated_asc">Oldest updated</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
              </select>
            </label>
          </div>
        </section>

        {error ? <p className={styles.error}>{error}</p> : null}

        {showBulkBar ? (
          <div className={styles.bulkBar}>
            <span className={styles.bulkSummary}>
              {selectedCount} selected on this page
            </span>
            <div className={styles.bulkActions}>
              {statusFilter !== "archived" ? (
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={managing}
                  onClick={() =>
                    void runBulkAction("archive", [...selectedIds])
                  }
                >
                  Archive selected
                </button>
              ) : null}
              {statusFilter !== "active" ? (
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={managing}
                  onClick={() =>
                    void runBulkAction("restore", [...selectedIds])
                  }
                >
                  Restore selected
                </button>
              ) : null}
              <button
                type="button"
                className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                disabled={managing}
                onClick={() =>
                  setConfirmDelete({
                    ids: [...selectedIds],
                    label: `${selectedCount} forms`,
                  })
                }
              >
                Delete selected
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className={styles.loadingCard}>
            <span className={styles.spinner} aria-hidden="true" />
            Loading forms...
          </div>
        ) : forms.length === 0 ? (
          <div className={styles.emptyState}>
            <p>
              {searchQuery
                ? "No forms match your search."
                : statusFilter === "archived"
                  ? "No archived forms yet."
                  : "No forms yet. Use the Creator Co-Pilot to compile your first one."}
            </p>
            {statusFilter === "active" && !searchQuery ? (
              <Link href="/admin/new" className={styles.createButton}>
                Start Co-Pilot
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className={styles.listHeader}>
              <label className={styles.selectAll}>
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                />
                <span>Select all on page</span>
              </label>
              <p className={styles.resultCount}>
                Showing {rangeStart}–{rangeEnd} of {pagination.total}
              </p>
            </div>

            <div className={styles.list}>
              {forms.map((form) => {
                const isBusy = busyBlueprintId === form.id || managing;
                const wasCopied = copiedBlueprintId === form.id;
                const isSelected = selectedIds.has(form.id);

                return (
                  <article
                    key={form.id}
                    className={
                      isSelected
                        ? `${styles.card} ${styles.cardSelected}`
                        : styles.card
                    }
                  >
                    <div className={styles.cardTop}>
                      <label className={styles.cardCheckbox}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(form.id)}
                        />
                      </label>

                      <div className={styles.cardHeader}>
                        <div>
                          <div className={styles.cardTitleRow}>
                            <h2 className={styles.cardTitle}>{form.label}</h2>
                            {form.isArchived ? (
                              <span className={styles.archivedBadge}>
                                Archived
                              </span>
                            ) : null}
                          </div>
                          <div className={styles.cardMeta}>
                            <span>
                              Created {formatSubmissionDate(form.createdAt)}
                            </span>
                            <span>
                              Updated {formatSubmissionDate(form.updatedAt)}
                            </span>
                            <span>{form.sessionCount} sessions</span>
                          </div>
                        </div>
                        <span className={styles.submissionBadge}>
                          {form.submissionCount} submission
                          {form.submissionCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <Link
                        href={`/admin/blueprints/${form.id}/analytics`}
                        className={styles.actionLink}
                      >
                        Analytics
                      </Link>
                      {!form.isArchived ? (
                        <>
                          <button
                            type="button"
                            className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                            disabled={isBusy}
                            onClick={() =>
                              void handleStartSession(form.id, "open")
                            }
                          >
                            {busyBlueprintId === form.id
                              ? "Creating link..."
                              : "Open form"}
                          </button>
                          <button
                            type="button"
                            className={styles.actionButton}
                            disabled={isBusy}
                            onClick={() =>
                              void handleStartSession(form.id, "copy")
                            }
                          >
                            {wasCopied ? "Link copied" : "Copy form link"}
                          </button>
                        </>
                      ) : null}
                      {form.isArchived ? (
                        <button
                          type="button"
                          className={styles.actionButton}
                          disabled={isBusy}
                          onClick={() => void patchBlueprint(form.id, false)}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.actionButton}
                          disabled={isBusy}
                          onClick={() => void patchBlueprint(form.id, true)}
                        >
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                        disabled={isBusy}
                        onClick={() =>
                          setConfirmDelete({
                            ids: [form.id],
                            label: form.label,
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>

                    {wasCopied ? (
                      <p className={styles.inlineNotice}>
                        A fresh single-use intake link was copied to your
                        clipboard.
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>

            {pagination.totalPages > 1 ? (
              <nav className={styles.pagination} aria-label="Forms pagination">
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>
                <span className={styles.pageStatus}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={
                    pagination.page >= pagination.totalPages || loading
                  }
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.totalPages, current + 1),
                    )
                  }
                >
                  Next
                </button>
              </nav>
            ) : null}
          </>
        )}
      </div>

      {confirmDelete ? (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-dialog-title" className={styles.dialogTitle}>
              Delete form permanently?
            </h2>
            <p id="delete-dialog-description" className={styles.dialogBody}>
              <strong>{confirmDelete.label}</strong> and all related intake
              sessions will be removed. This cannot be undone.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                disabled={managing || busyBlueprintId !== null}
                onClick={() => {
                  if (confirmDelete.ids.length === 1) {
                    void deleteBlueprint(confirmDelete.ids[0]!);
                  } else {
                    void runBulkAction("delete", confirmDelete.ids);
                  }
                }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
