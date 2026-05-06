package com.taskflow.backend.service;

import com.taskflow.backend.dto.reporting.AdminDashboardResponse;
import com.taskflow.backend.dto.reporting.ChartSeriesResponse;
import com.taskflow.backend.dto.reporting.ClientDashboardResponse;
import com.taskflow.backend.dto.reporting.CollaboratorDashboardResponse;
import com.taskflow.backend.dto.reporting.NamedCountResponse;
import com.taskflow.backend.dto.reporting.ProjectManagerDashboardResponse;
import com.taskflow.backend.entity.Comment;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.CommentRepository;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardReportingService {

    private static final EnumSet<TaskStatus> STATUS_ORDER =
            EnumSet.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.ON_HOLD,
                    TaskStatus.IN_REVIEW, TaskStatus.DONE);

    private static final DateTimeFormatter DAY_KEY = DateTimeFormatter.ISO_LOCAL_DATE;

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final CommentRepository commentRepository;

    @Transactional(readOnly = true)
    public CollaboratorDashboardResponse collaboratorDashboard(User user) {
        if (user.getRole() != UserRole.COLLABORATOR) {
            throw new UnauthorizedException("Collaborator dashboard is restricted to collaborators");
        }
        List<Task> myTasks = taskRepository.findByCollaboratorsContaining(user);
        long total = myTasks.size();
        long done = countStatus(myTasks, TaskStatus.DONE);
        long hold = countStatus(myTasks, TaskStatus.ON_HOLD);
        long overdue = myTasks.stream().filter(this::isOverdueActive).count();
        double completionPct = total == 0 ? 100.0 : (100.0 * done / total);

        ChartSeriesResponse statusChart = donutFromTasks(myTasks);
        ChartSeriesResponse perProject = tasksPerProjectChart(myTasks);

        Set<Long> doneIds = myTasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.DONE)
                .map(Task::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Double avgDays = averageCompletionDays(doneIds);

        long rejectedGuess = commentRepository.countTasksWithPmRevisionSignalForCollaborator(user.getId());
        long inReview = countStatus(myTasks, TaskStatus.IN_REVIEW);

        List<CollaboratorDashboardResponse.OverdueTaskRow> overdueRows = myTasks.stream()
                .filter(this::isOverdueActive)
                .sorted(Comparator.comparing(Task::getDeadline, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(t -> new CollaboratorDashboardResponse.OverdueTaskRow(
                        t.getTitle(),
                        t.getDeadline() != null ? t.getDeadline().toString() : "",
                        projectName(t)))
                .toList();

        List<CollaboratorDashboardResponse.OnHoldTaskRow> holdRows = myTasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.ON_HOLD)
                .map(t -> new CollaboratorDashboardResponse.OnHoldTaskRow(
                        t.getTitle(),
                        t.getHoldReason() != null ? t.getHoldReason() : "",
                        projectName(t)))
                .toList();

        return new CollaboratorDashboardResponse(
                total,
                done,
                hold,
                overdue,
                statusChart,
                perProject,
                round1(completionPct),
                avgDays,
                rejectedGuess,
                inReview,
                overdueRows,
                holdRows
        );
    }

    @Transactional(readOnly = true)
    public ProjectManagerDashboardResponse projectManagerDashboard(User user) {
        if (user.getRole() != UserRole.PROJECT_MANAGER) {
            throw new UnauthorizedException("Invalid role for project manager dashboard");
        }
        List<Project> projects = projectRepository.findDistinctByManagerForReporting(user);
        List<Task> allTasks = projects.stream().flatMap(p -> safeTasks(p).stream()).toList();
        long total = allTasks.size();
        long done = countStatus(allTasks, TaskStatus.DONE);
        long blocked = countStatus(allTasks, TaskStatus.ON_HOLD);
        long review = countStatus(allTasks, TaskStatus.IN_REVIEW);

        ChartSeriesResponse projectProgress = progressPerProjectSeries(projects);
        ChartSeriesResponse statusDonut = donutFromTasks(allTasks);
        ChartSeriesResponse collabDone = collaboratorDoneCounts(allTasks);
        ChartSeriesResponse trend30 = completionTrendLast30Days(allTasks);

        Set<Long> projectIds = projects.stream().map(Project::getId).filter(Objects::nonNull).collect(Collectors.toSet());

        Map<Long, LocalDateTime> maxCommentMap = commentMaxDates(taskIds(allTasks));

        List<ProjectManagerDashboardResponse.ProjectSummaryRow> projRows = projects.stream()
                .map(p -> {
                    List<Task> ts = safeTasks(p);
                    long tt = ts.size();
                    long cd = countStatus(ts, TaskStatus.DONE);
                    int pct = progressPercent(tt, cd);
                    LocalDate ddl = p.getDeadline();
                    String ddlIso = ddl != null ? ddl.toString() : "";
                    return new ProjectManagerDashboardResponse.ProjectSummaryRow(
                            p.getName(),
                            tt,
                            cd,
                            pct,
                            ddlIso,
                            atRisk(p, ts) ? "AT_RISK" : "ON_TRACK"
                    );
                })
                .toList();

        Map<Long, List<Task>> tasksByCollaborator = new HashMap<>();
        for (Task t : allTasks) {
            if (t.getCollaborators() == null) continue;
            for (User c : t.getCollaborators()) {
                if (c == null || c.getId() == null) continue;
                tasksByCollaborator.computeIfAbsent(c.getId(), _k -> new ArrayList<>()).add(t);
            }
        }

        List<ProjectManagerDashboardResponse.CollaboratorPerformanceRow> perfRows =
                tasksByCollaborator.entrySet().stream().map(e -> {
                    User collab = userRepository.findById(e.getKey()).orElse(null);
                    List<Task> ts = e.getValue();
                    long tt = ts.size();
                    long d = countStatus(ts, TaskStatus.DONE);
                    long oh = countStatus(ts, TaskStatus.ON_HOLD);
                    long rej = revisionCountInProjects(e.getKey(), projectIds);
                    long ovd = ts.stream().filter(this::isOverdueActive).count();
                    double base = tt == 0 ? 100.0 : (100.0 * d / tt);
                    double penalized = base - 6.0 * rej - 4.0 * ovd;
                    int score = (int) Math.round(Math.max(0, Math.min(100, penalized)));
                    return new ProjectManagerDashboardResponse.CollaboratorPerformanceRow(
                            collabDisplayName(collab != null ? collab : orphanUser(e.getKey())),
                            tt,
                            d,
                            oh,
                            rej,
                            score
                    );
                })
                .sorted(Comparator.comparingInt(ProjectManagerDashboardResponse.CollaboratorPerformanceRow::performanceScore).reversed())
                .toList();

        LocalDateTime now = LocalDateTime.now();
        List<ProjectManagerDashboardResponse.InReviewAttentionRow> reviewAttention = allTasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.IN_REVIEW)
                .map(t -> new ProjectManagerDashboardResponse.InReviewAttentionRow(
                        t.getTitle(),
                        assigneeLabels(t),
                        waitingHoursApprox(t, maxCommentMap, now)))
                .toList();

        List<ProjectManagerDashboardResponse.OnHoldAttentionRow> holdAttention = allTasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.ON_HOLD)
                .map(t -> new ProjectManagerDashboardResponse.OnHoldAttentionRow(
                        t.getTitle(),
                        assigneeLabels(t),
                        optionalStr(t.getHoldReason())))
                .toList();

        return new ProjectManagerDashboardResponse(
                projects.size(),
                total,
                done,
                blocked,
                review,
                projectProgress,
                statusDonut,
                collabDone,
                trend30,
                projRows,
                perfRows,
                reviewAttention,
                holdAttention
        );
    }

    @Transactional(readOnly = true)
    public AdminDashboardResponse adminDashboard(User user) {
        if (user.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Admin only");
        }
        List<User> allUsersList = userRepository.findAll();
        long totalUsers = allUsersList.size();
        List<Project> projects = projectRepository.findAllDistinctForReporting();
        List<Task> allTasks = taskRepository.findAllFetchingProject();

        Map<UserRole, Long> roleBuckets = Arrays.stream(UserRole.values())
                .collect(Collectors.toMap(r -> r, r -> allUsersList.stream().filter(u -> u.getRole() == r).count()));
        ChartSeriesResponse usersByRole = new ChartSeriesResponse(
                Arrays.stream(UserRole.values()).map(Enum::name).toList(),
                Arrays.stream(UserRole.values()).map(r -> roleBuckets.getOrDefault(r, 0L)).toList()
        );

        long totalProj = projects.size();
        long totalT = allTasks.size();
        long done = countStatus(allTasks, TaskStatus.DONE);
        double platPct = totalT == 0 ? 100.0 : (100.0 * done / totalT);
        long blocked = countStatus(allTasks, TaskStatus.ON_HOLD);
        long inactive = userRepository.countByIsActive(false);

        Map<String, Long> perProjName = projects.stream().collect(Collectors.toMap(
                Project::getName,
                p -> (long) safeTasks(p).size(),
                Long::sum
        ));
        ChartSeriesResponse tasksBar = sortedChartByValueDesc(perProjName);

        Map<String, Double> pmRate = completionRatePerManager(projects);
        ChartSeriesResponse pmChart = sortedChart(pmRate);

        ChartSeriesResponse trend = completionTrendLast30Days(allTasks);
        ChartSeriesResponse platStatus = donutFromTasks(allTasks);

        List<AdminDashboardResponse.AdminProjectOverviewRow> projOverview = projects.stream()
                .map(p -> {
                    List<Task> ts = safeTasks(p);
                    long tt = ts.size();
                    long cd = countStatus(ts, TaskStatus.DONE);
                    int pct = progressPercent(tt, cd);
                    User mgr = p.getManager();
                    return new AdminDashboardResponse.AdminProjectOverviewRow(
                            p.getName(),
                            collabDisplayName(mgr != null ? mgr : null),
                            tt,
                            pct,
                            p.getDeadline() != null ? p.getDeadline().toString() : "",
                            atRisk(p, ts) ? "AT_RISK" : "ON_TRACK"
                    );
                })
                .toList();

        List<AdminDashboardResponse.AdminUserOverviewRow> usersOverview = new ArrayList<>();

        Map<Long, List<Task>> assigned = new HashMap<>();
        for (Task t : allTasks) {
            if (t.getCollaborators() == null) continue;
            for (User c : t.getCollaborators()) {
                if (c == null || c.getId() == null) continue;
                assigned.computeIfAbsent(c.getId(), _k -> new ArrayList<>()).add(t);
            }
        }

        for (User u : allUsersList) {
            long asg = assigned.getOrDefault(u.getId(), List.of()).size();
            List<Task> ut = assigned.getOrDefault(u.getId(), List.of());
            long d = ut.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
            int cp = ut.isEmpty() ? 100 : (int) Math.round((100.0 * d / ut.size()));
            String stat = u.isActive() ? "ACTIVE" : "DISABLED";
            usersOverview.add(new AdminDashboardResponse.AdminUserOverviewRow(
                    collabDisplayName(u),
                    u.getRole() != null ? u.getRole().name() : "",
                    asg,
                    cp,
                    stat
            ));
        }

        LocalDateTime nowDt = LocalDateTime.now();

        Set<Long> allProjectIds = projects.stream().map(Project::getId).filter(Objects::nonNull).collect(Collectors.toSet());

        List<NamedCountResponse> rankedHolds = allTasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.ON_HOLD && t.getHoldReason() != null
                        && !t.getHoldReason().isBlank())
                .collect(Collectors.groupingBy(t -> normalizeHold(t.getHoldReason()), Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(15)
                .map(e -> new NamedCountResponse(e.getKey(), e.getValue()))
                .toList();

        AdminDashboardResponse.SystemHealthResponse health =
                new AdminDashboardResponse.SystemHealthResponse(
                        projectsPastDeadline(projects),
                        countOverdueActive(allTasks),
                        longRunningBlockers(allTasks, nowDt),
                        rankedHolds
                );

        List<AdminDashboardResponse.NamedLongScoreRow> topCollab =
                topCollaboratorsByScore(assigned, allProjectIds).stream().limit(3).toList();

        List<AdminDashboardResponse.NamedLongScoreRow> topPms =
                completionRatePerManager(projects).entrySet().stream()
                        .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                        .limit(3)
                        .map(e -> new AdminDashboardResponse.NamedLongScoreRow(e.getKey(), Math.round(e.getValue())))
                        .toList();

        return new AdminDashboardResponse(
                totalUsers,
                totalProj,
                totalT,
                round1(platPct),
                blocked,
                inactive,
                usersByRole,
                tasksBar,
                pmChart,
                trend,
                platStatus,
                projOverview,
                usersOverview.stream()
                        .sorted(Comparator.comparing(AdminDashboardResponse.AdminUserOverviewRow::name))
                        .toList(),
                health,
                topCollab,
                topPms
        );
    }

    @Transactional(readOnly = true)
    public ClientDashboardResponse clientDashboard(User client) {
        if (client.getRole() != UserRole.CLIENT) {
            throw new UnauthorizedException("Clients only");
        }
        List<Project> portfolio = projectRepository.findDistinctActiveByMemberForReporting(client);
        List<Task> allTasks = portfolio.stream().flatMap(p -> safeTasks(p).stream()).toList();
        long atRiskProj = portfolio.stream().filter(p -> atRisk(p, safeTasks(p))).count();
        int overallPct = overallWeightedCompletion(portfolio);

        ChartSeriesResponse bar = chartProjectProgress(portfolio);
        ChartSeriesResponse donut = donutFromTasks(allTasks);

        List<ClientDashboardResponse.ClientProjectCard> cards = portfolio.stream().map(p -> {
            List<Task> ts = safeTasks(p);
            long tt = ts.size();
            long cd = countStatus(ts, TaskStatus.DONE);
            int pct = progressPercent(tt, cd);
            String ddlIso = p.getDeadline() != null ? p.getDeadline().toString() : "";

            List<ClientDashboardResponse.ClientTaskSummary> taskRows = ts.stream()
                    .sorted(Comparator.comparing(Task::getDeadline, Comparator.nullsLast(Comparator.naturalOrder())))
                    .map(t -> new ClientDashboardResponse.ClientTaskSummary(
                            t.getTitle(),
                            assigneeLabels(t),
                            t.getStatus() != null ? t.getStatus().name() : "",
                            t.getDeadline() != null ? t.getDeadline().toString() : ""
                    ))
                    .toList();

            return new ClientDashboardResponse.ClientProjectCard(
                    p.getId(),
                    p.getName(),
                    pct,
                    tt,
                    cd,
                    ddlIso,
                    atRisk(p, ts) ? "AT_RISK" : "ON_TRACK",
                    taskRows
            );
        }).toList();

        List<ClientDashboardResponse.ClientProjectTimeline> timelines = portfolio.stream().map(p -> {
            List<ClientDashboardResponse.TimelineEntry> ents = safeTasks(p).stream()
                    .sorted(Comparator.comparing(Task::getDeadline, Comparator.nullsLast(Comparator.naturalOrder())))
                    .map(t -> new ClientDashboardResponse.TimelineEntry(
                            t.getTitle(),
                            assigneeLabels(t),
                            t.getStatus() != null ? t.getStatus().name() : "",
                            t.getDeadline() != null ? t.getDeadline().toString() : ""
                    ))
                    .toList();
            return new ClientDashboardResponse.ClientProjectTimeline(p.getId(), p.getName(), ents);
        }).toList();

        List<ClientDashboardResponse.ClientActivityItem> activity = buildClientActivity(portfolio,
                client.getId());

        return new ClientDashboardResponse(
                portfolio.size(),
                overallPct,
                atRiskProj,
                bar,
                donut,
                cards,
                timelines,
                activity
        );
    }

    // --- Helpers ---

    private List<ClientDashboardResponse.ClientActivityItem> buildClientActivity(
            List<Project> portfolio, Long clientUserId
    ) {
        List<ClientDashboardResponse.ClientActivityItem> rows = new ArrayList<>();
        for (Project p : portfolio) {
            if (Boolean.TRUE.equals(p.isDelivered())) {
                rows.add(new ClientDashboardResponse.ClientActivityItem(
                        formatActivityTime(LocalDateTime.now()),
                        "Project \"" + p.getName() + "\" marked as delivered.",
                        "MILESTONE"
                ));
            }
        }

        PageRequest pageable = PageRequest.of(0, 40);
        List<Comment> chunk = commentRepository.findRecentForClientPortfolio(clientUserId, pageable);
        for (Comment c : chunk) {
            Task t = c.getTask();
            User u = c.getUser();
            String who = "";
            if (u != null) {
                if (u.getRole() == UserRole.PROJECT_MANAGER) {
                    who = "Project manager";
                } else {
                    who = "Team member";
                }
            }
            rows.add(new ClientDashboardResponse.ClientActivityItem(
                    formatActivityTime(c.getCreatedAt() != null ? c.getCreatedAt() : LocalDateTime.now()),
                    who + " added an update related to \"" + (t != null ? t.getTitle() : "") + "\".",
                    "UPDATE"
            ));
        }

        for (Project p : portfolio) {
            for (Task t : safeTasks(p)) {
                if (t.getStatus() == TaskStatus.IN_REVIEW) {
                    rows.add(new ClientDashboardResponse.ClientActivityItem(
                            formatActivityTime(LocalDateTime.now()),
                            "Task \"" + t.getTitle() + "\" submitted for approval (project \"" + p.getName() + "\").",
                            "REVIEW"
                    ));
                }
                if (t.getStatus() == TaskStatus.DONE) {
                    rows.add(new ClientDashboardResponse.ClientActivityItem(
                            formatActivityTime(LocalDateTime.now()),
                            "Task \"" + t.getTitle() + "\" completed.",
                            "COMPLETED"
                    ));
                }
            }
        }

        rows.sort(Comparator.comparing(ClientDashboardResponse.ClientActivityItem::occurredAtIso).reversed());
        return rows.stream().limit(40).toList();
    }

    private User orphanUser(Long id) {
        User ghost = new User();
        ghost.setId(id);
        ghost.setEmail("user-" + id);
        return ghost;
    }

    private String formatActivityTime(LocalDateTime ldt) {
        return DateTimeFormatter.ISO_LOCAL_DATE_TIME.format(ldt);
    }

    private long longRunningBlockers(List<Task> allTasks, LocalDateTime now) {
        LocalDate cutoff = now.toLocalDate().minusDays(3);
        return allTasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.ON_HOLD
                        && t.getDeadline() != null
                        && t.getDeadline().toLocalDate().isBefore(cutoff))
                .count();
    }

    private long projectsPastDeadline(List<Project> projects) {
        LocalDate t = LocalDate.now();
        return projects.stream().filter(p -> !p.isDelivered()
                && p.getDeadline() != null
                && p.getDeadline().isBefore(t)).count();
    }

    private ChartSeriesResponse sortedChart(Map<String, Double> map) {
        List<Map.Entry<String, Double>> ents = map.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .toList();
        List<String> labels = ents.stream().map(Map.Entry::getKey).toList();
        List<Long> values = ents.stream().map(e -> Math.round(e.getValue())).toList();
        return new ChartSeriesResponse(labels, values);
    }

    private ChartSeriesResponse sortedChartByValueDesc(Map<String, Long> map) {
        List<Map.Entry<String, Long>> ents = map.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .toList();
        return new ChartSeriesResponse(
                ents.stream().map(Map.Entry::getKey).toList(),
                ents.stream().map(Map.Entry::getValue).toList()
        );
    }

    private Map<String, Double> completionRatePerManager(List<Project> projects) {
        Map<Long, TempAgg> agg = new HashMap<>();
        for (Project p : projects) {
            User m = p.getManager();
            if (m == null || m.getId() == null) continue;
            TempAgg tg = agg.computeIfAbsent(m.getId(), id -> new TempAgg(collabDisplayName(m)));
            for (Task t : safeTasks(p)) {
                tg.total++;
                if (t.getStatus() == TaskStatus.DONE) {
                    tg.done++;
                }
            }
        }
        Map<String, Double> out = new LinkedHashMap<>();
        for (TempAgg tg : agg.values()) {
            double pct = tg.total == 0 ? 100.0 : (100.0 * tg.done / tg.total);
            out.put(tg.label, pct);
        }
        return out;
    }

    private static final class TempAgg {
        final String label;
        long total;
        long done;

        TempAgg(String label) {
            this.label = label;
        }
    }

    private List<AdminDashboardResponse.NamedLongScoreRow> topCollaboratorsByScore(
            Map<Long, List<Task>> assignedByUser,
            Set<Long> allProjectIds
    ) {
        List<AdminDashboardResponse.NamedLongScoreRow> rows = new ArrayList<>();
        for (Map.Entry<Long, List<Task>> e : assignedByUser.entrySet()) {
            User u = userRepository.findById(e.getKey()).orElse(null);
            if (u == null || u.getRole() != UserRole.COLLABORATOR) {
                continue;
            }
            List<Task> ts = e.getValue();
            long total = ts.size();
            long doneCnt = ts.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
            long overdue = ts.stream().filter(this::isOverdueActive).count();
            long rej = revisionCountInProjects(e.getKey(), allProjectIds);
            double base = total == 0 ? 100.0 : (100.0 * doneCnt / total);
            int score = (int) Math.round(Math.max(0, Math.min(100, base - 6 * rej - 4 * overdue)));
            rows.add(new AdminDashboardResponse.NamedLongScoreRow(collabDisplayName(u), score));
        }
        rows.sort(Comparator.comparingLong(AdminDashboardResponse.NamedLongScoreRow::score).reversed());
        return rows;
    }

    private long revisionCountInProjects(Long collaboratorId, Set<Long> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) {
            return 0;
        }
        return commentRepository.countTasksWithPmRevisionSignalForCollaboratorInProjects(
                collaboratorId, projectIds);
    }

    private ChartSeriesResponse chartProjectProgress(List<Project> projects) {
        List<String> labels = new ArrayList<>();
        List<Long> values = new ArrayList<>();
        for (Project p : projects) {
            List<Task> ts = safeTasks(p);
            labels.add(p.getName());
            values.add((long) progressPercent(ts.size(), countStatus(ts, TaskStatus.DONE)));
        }
        return new ChartSeriesResponse(labels, values);
    }

    private int overallWeightedCompletion(List<Project> projects) {
        long tot = projects.stream().mapToLong(p -> safeTasks(p).size()).sum();
        long don = projects.stream().mapToLong(p -> countStatus(safeTasks(p), TaskStatus.DONE)).sum();
        return tot == 0 ? 100 : (int) Math.round((100.0 * don / tot));
    }

    private ChartSeriesResponse progressPerProjectSeries(List<Project> projects) {
        return chartProjectProgress(projects);
    }

    private ChartSeriesResponse collaboratorDoneCounts(List<Task> tasks) {
        Map<String, Long> cnt = new HashMap<>();
        for (Task t : tasks) {
            if (t.getStatus() != TaskStatus.DONE) continue;
            if (t.getCollaborators() == null) continue;
            for (User c : t.getCollaborators()) {
                String lbl = collabDisplayName(c);
                cnt.merge(lbl, 1L, Long::sum);
            }
        }
        return sortedChart(cnt.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> (double) e.getValue())));
    }

    private ChartSeriesResponse completionTrendLast30Days(List<Task> tasks) {
        Map<Long, LocalDateTime> maxMap = commentMaxDates(
                tasks.stream().filter(t -> t.getStatus() == TaskStatus.DONE)
                        .map(Task::getId).filter(Objects::nonNull).toList());

        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(29);

        Map<LocalDate, Long> buckets = new TreeMap<>();
        for (Task t : tasks) {
            if (t.getStatus() != TaskStatus.DONE || t.getId() == null) {
                continue;
            }
            LocalDateTime dt = maxMap.get(t.getId());
            if (dt == null) {
                continue;
            }
            LocalDate bucket = dt.toLocalDate();
            if (bucket.isBefore(start) || bucket.isAfter(end)) {
                continue;
            }
            buckets.merge(bucket, 1L, Long::sum);
        }

        List<String> labels = new ArrayList<>();
        List<Long> values = new ArrayList<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            labels.add(d.format(DAY_KEY));
            values.add(buckets.getOrDefault(d, 0L));
        }
        return new ChartSeriesResponse(labels, values);
    }

    private Map<Long, LocalDateTime> commentMaxDates(Collection<Long> taskIds) {
        List<Long> ids = taskIds == null ? List.of()
                : taskIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) return Map.of();

        Map<Long, LocalDateTime> out = new HashMap<>();
        for (Object[] row : commentRepository.findMaxCreatedAtByTaskIdIn(ids)) {
            if (row[0] == null || row[1] == null) continue;
            out.put((Long) row[0], (LocalDateTime) row[1]);
        }
        return out;
    }

    private Double averageCompletionDays(Set<Long> doneTaskIds) {
        if (doneTaskIds == null || doneTaskIds.isEmpty()) return null;
        List<Long> ids = new ArrayList<>(doneTaskIds);
        Map<Long, LocalDateTime> minMap = rowMap(commentRepository.findMinCreatedAtByTaskIdIn(ids));
        Map<Long, LocalDateTime> maxMap = rowMap(commentRepository.findMaxCreatedAtByTaskIdIn(ids));
        double sum = 0;
        int n = 0;
        for (Long id : ids) {
            LocalDateTime mn = minMap.get(id);
            LocalDateTime mx = maxMap.get(id);
            if (mn != null && mx != null && !mx.isBefore(mn)) {
                sum += ChronoUnit.DAYS.between(mn.toLocalDate(), mx.toLocalDate()) + (
                        mn.toLocalTime().equals(mx.toLocalTime()) ? 0 : 0);
                n++;
            }
        }
        if (n == 0) return null;
        return round1(sum / n);
    }

    private Map<Long, LocalDateTime> rowMap(List<Object[]> rows) {
        Map<Long, LocalDateTime> map = new HashMap<>();
        for (Object[] r : rows) {
            map.put((Long) r[0], (LocalDateTime) r[1]);
        }
        return map;
    }

    private ChartSeriesResponse tasksPerProjectChart(List<Task> myTasks) {
        Map<String, Long> agg = myTasks.stream().collect(Collectors.groupingBy(this::projectName,
                Collectors.counting()));
        return sortedChartByValueDesc(agg);
    }

    private ChartSeriesResponse donutFromTasks(List<Task> tasks) {
        List<String> labels = new ArrayList<>();
        List<Long> values = new ArrayList<>();
        for (TaskStatus s : STATUS_ORDER) {
            labels.add(s.name());
            values.add(countStatus(tasks, s));
        }
        return new ChartSeriesResponse(labels, values);
    }

    private Collection<Long> taskIds(Collection<Task> tasks) {
        return tasks.stream().map(Task::getId).filter(Objects::nonNull).toList();
    }

    private long countStatus(Collection<Task> tasks, TaskStatus s) {
        return tasks.stream().filter(t -> t.getStatus() == s).count();
    }

    private boolean isOverdueActive(Task t) {
        return t != null && t.getStatus() != TaskStatus.DONE
                && t.getDeadline() != null
                && t.getDeadline().isBefore(LocalDateTime.now());
    }

    private long countOverdueActive(List<Task> tasks) {
        return tasks.stream().filter(this::isOverdueActive).count();
    }

    private int progressPercent(long total, long done) {
        return total <= 0 ? 100 : (int) Math.round((100.0 * done / total));
    }

    private boolean atRisk(Project p, List<Task> ts) {
        if (p.getDeadline() == null) return false;
        long days = ChronoUnit.DAYS.between(LocalDate.now(), p.getDeadline());
        int prog = progressPercent(ts.size(), countStatus(ts, TaskStatus.DONE));
        return days <= 7 && prog < 80;
    }

    private long waitingHoursApprox(Task t,
            Map<Long, LocalDateTime> maxComments,
            LocalDateTime now) {
        LocalDateTime last = maxComments != null ? maxComments.get(t.getId()) : null;
        if (last == null) {
            return 0;
        }
        return Math.max(0, ChronoUnit.HOURS.between(last, now));
    }

    private List<Task> safeTasks(Project p) {
        List<Task> t = p.getTasks();
        return t != null ? t : List.of();
    }

    private String assigneeLabels(Task task) {
        if (task.getCollaborators() == null) return "";
        return task.getCollaborators().stream()
                .filter(Objects::nonNull)
                .map(this::collabDisplayName)
                .filter(s -> !s.isBlank())
                .distinct()
                .collect(Collectors.joining(", "));
    }

    private String collabDisplayName(User user) {
        if (user == null) return "";
        String f = trimOrEmpty(user.getFirstName());
        String l = trimOrEmpty(user.getLastName());
        String full = String.join(" ", f, l).trim();
        return !full.isEmpty() ? full : trimOrEmpty(user.getEmail());
    }

    private String trimOrEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    private String projectName(Task t) {
        if (t == null || t.getProject() == null) return "";
        String n = t.getProject().getName();
        return n != null ? n : "";
    }

    private String optionalStr(String s) {
        return s != null ? s : "";
    }

    private double round1(double x) {
        return Math.round(x * 10.0) / 10.0;
    }

    private String normalizeHold(String r) {
        if (r == null) {
            return "";
        }
        String s = r.strip();
        if (s.isEmpty()) {
            return "";
        }
        return s.length() <= 200 ? s : s.substring(0, 200);
    }
}

