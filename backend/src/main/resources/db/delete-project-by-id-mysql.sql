-- =============================================================================
-- Supprimer un projet et toutes les lignes liées (MySQL / Workbench)
-- Base utilisée par l’appli : par défaut taskflow (voir spring.datasource.url)
--
-- Remplacez la valeur ci-dessous par l’id du projet (colonne project.id).
-- Liste des projets :  SELECT id, name, manager_id FROM project ORDER BY id;
-- Projets créés par un manager : SELECT id, name FROM project WHERE manager_id = ID_DU_MANAGER;
--
-- ⚠ Sauvegarder la base avant toute suppression en masse.
-- ⚠ Les fichiers sur disque (dossier backend/uploads/) ne sont pas effacés par ce script :
--    supprimez-les à la main si besoin après avoir lu uploaded_files.file_url.
-- =============================================================================

SET @pid = 1;  -- <<< MODIFIER : id du projet à supprimer

-- 1. Rapports de tâches
DELETE tr FROM task_reports tr
INNER JOIN task t ON t.id = tr.task_id
WHERE t.project_id = @pid;

-- 2. Commentaires sur les tâches (si erreur « table doesn't exist », commentez tout le bloc —
--    ou vérifiez le nom avec SHOW TABLES LIKE '%omm%';)
DELETE c FROM `comment` c
INNER JOIN task t ON t.id = c.task_id
WHERE t.project_id = @pid;

-- 3. Fichiers rattachés aux tâches de ce projet
DELETE uf FROM uploaded_files uf
INNER JOIN task t ON t.id = uf.task_id
WHERE t.project_id = @pid;

-- 4. Participation collaborateurs aux tâches
DELETE tc FROM task_collaborators tc
INNER JOIN task t ON t.id = tc.task_id
WHERE t.project_id = @pid;

-- 5. Tâches du projet
DELETE FROM task WHERE project_id = @pid;

-- 6. Fichiers directement sur le projet (sans task_id)
DELETE FROM uploaded_files WHERE project_id = @pid;

-- 7. Membres du projet (liaison projet ↔ utilisateurs)
DELETE FROM project_users WHERE project_id = @pid;

-- 8. Compétences requises du projet
DELETE FROM project_required_skills WHERE project_id = @pid;

-- 9. Propositions qui pointent vers ce projet créé après approbation
UPDATE project_proposals SET resulting_project_id = NULL WHERE resulting_project_id = @pid;

-- 10. Projet lui-même
DELETE FROM project WHERE id = @pid;

-- Vérifier : la ligne doit disparaître
-- SELECT id, name FROM project WHERE id = @pid;
