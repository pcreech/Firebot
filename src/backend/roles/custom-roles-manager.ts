import { JsonDB } from "node-json-db";
import path from "path";

import logger from "../logwrapper";
import util from "../utility";
import profileManager from "../common/profile-manager";
import frontendCommunicator from "../common/frontend-communicator";
import twitchApi from "../twitch-api/api";
import twitchRoleManager from "../../shared/twitch-roles";
import { BasicViewer } from "../../types/viewers";

interface LegacyCustomRole {
    id: string;
    name: string;
    viewers: string[];
}

interface CustomRole {
    id: string;
    name: string;
    viewers: Array<{
        id: string;
        username: string;
        displayName: string;
    }>;
}

const ROLES_FOLDER = "roles";

class CustomRolesManager {
    private _customRoles: Record<string, CustomRole> = {};

    constructor() {
        frontendCommunicator.onAsync("get-custom-roles", async () => this._customRoles);

        frontendCommunicator.on("save-custom-role", (role: CustomRole) => {
            this.saveCustomRole(role);
        });

        frontendCommunicator.on("delete-custom-role", (roleId: string) => {
            this.deleteCustomRole(roleId);
        });
    }

    async migrateLegacyCustomRoles(): Promise<void> {
        // Check for legacy custom roles file
        if (profileManager.profileDataPathExistsSync(path.join(ROLES_FOLDER, "customroles.json"))) {
            logger.info("Legacy custom roles file detected. Starting migration.");

            try {
                const legacyCustomRolesDb = profileManager.getJsonDbInProfile(path.join(ROLES_FOLDER, "customroles"));
                const legacyCustomRoles: Record<string, LegacyCustomRole> = legacyCustomRolesDb.getData("/");

                for (const legacyRole of Object.values(legacyCustomRoles)) {
                    logger.info(`Migrating custom role ${legacyRole.name}`);

                    const newCustomRole: CustomRole = {
                        id: legacyRole.id,
                        name: legacyRole.name,
                        viewers: []
                    };

                    const users = await twitchApi.users.getUsersByNames(legacyRole.viewers);
                    for (const user of users) {
                        newCustomRole.viewers.push({
                            id: user.id,
                            username: user.name,
                            displayName: user.displayName
                        });
                    }

                    this.saveCustomRole(newCustomRole);
                    logger.info(`Finished migrating custom role ${newCustomRole.name}`);
                }

                logger.info("Deleting legacy custom roles database");
                profileManager.deletePathInProfile(path.join(ROLES_FOLDER, "customroles.json"));

                logger.info("Legacy custom role migration complete");
            } catch (error) {
                logger.error("Unexpected error during custom role migration", error);
            }
        }
    }

    private getCustomRolesDb(): JsonDB {
        return profileManager.getJsonDbInProfile(path.join(ROLES_FOLDER, "custom-roles"));
    }

    async loadCustomRoles(): Promise<void> {
        await this.migrateLegacyCustomRoles();

        logger.debug("Attempting to load custom roles");

        const rolesDb = this.getCustomRolesDb();

        try {
            const customRolesData = rolesDb.getData("/");

            if (customRolesData != null) {
                this._customRoles = customRolesData;
            }

            logger.debug("Loaded custom roles");

            await this.refreshCustomRolesUserData();
        } catch (error) {
            logger.warn("There was an error reading custom roles data file", error);
        }
    }

    async refreshCustomRolesUserData(): Promise<void> {
        logger.debug("Refreshing custom role user data");

        for (const customRole of Object.values(this._customRoles ?? {})) {
            logger.debug(`Updating custom role ${customRole.name}`);

            const userIds = customRole.viewers.map(v => v.id);
            const users = await twitchApi.users.getUsersByIds(userIds);

            for (const user of users) {
                const viewerIndex = customRole.viewers.findIndex(v => v.id === user.id);
                customRole.viewers[viewerIndex] = {
                    id: user.id,
                    username: user.name,
                    displayName: user.displayName
                }
            }

            this.saveCustomRole(customRole);
            logger.debug(`Custom role ${customRole.name} updated`);
        }
    }

    saveCustomRole(role: CustomRole) {
        if (role == null) {
            return;
        }

        this._customRoles[role.id] = role;

        try {
            const rolesDb = this.getCustomRolesDb();

            rolesDb.push(`/${role.id}`, role);

            logger.debug(`Saved role ${role.id} to file.`);
        } catch (error) {
            logger.warn("There was an error saving a role.", error);
        }
    }

    addViewerToRole(roleId: string, viewer: BasicViewer) {
        if (!viewer?.id?.length) {
            return;
        }
        const role = this._customRoles[roleId];
        if (role != null) {
            if (role.viewers.map(v => v.id).includes(viewer.id)) {
                return;
            }

            role.viewers.push({
                id: viewer.id,
                username: viewer.username,
                displayName: viewer.displayName
            });

            this.saveCustomRole(role);

            this.triggerUiRefresh();
        }
    }

    getCustomRoles(): CustomRole[] {
        return Object.values(this._customRoles);
    }

    getRoleByName(name: string): CustomRole {
        const roles = this.getCustomRoles();
        const roleIndex = util.findIndexIgnoreCase(roles.map(r => r.name), name);
        return roleIndex < 0 ? null : roles[roleIndex];
    }

    getAllCustomRolesForViewer(userId: string) {
        const roles = this.getCustomRoles();
        return roles
            .filter(r => r.viewers.map(v => v.id).includes(userId))
            .map((r) => {
                return {
                    id: r.id,
                    name: r.name
                };
            });
    }

    userIsInRole(userId: string, userTwitchRoles: string[], roleIdsToCheck: string[]): boolean {
        const roles = [
            ...(userTwitchRoles || []).map(twitchRoleManager.mapTwitchRole),
            ...this.getAllCustomRolesForViewer(userId)
        ];
        return roles.some(r => r != null && roleIdsToCheck.includes(r.id));
    }

    removeViewerFromRole(roleId: string, userId: string) {
        if (!userId?.length) {
            return;
        }
        const role = this._customRoles[roleId];
        if (role != null) {
            const index = role.viewers.map(v => v.id).indexOf(userId);

            if (index === -1) {
                return;
            }

            role.viewers.splice(index, 1);

            this.saveCustomRole(role);

            exports.triggerUiRefresh();
        }
    }

    removeAllViewersFromRole(roleId: string): void {
        const role = this._customRoles[roleId];
        if (role != null) {
            role.viewers = [];

            this.saveCustomRole(role);

            exports.triggerUiRefresh();
        }
    }

    deleteCustomRole(roleId: string) {
        if (!roleId?.length) {
            return;
        }

        delete this._customRoles[roleId];

        try {
            const rolesDb = this.getCustomRolesDb();

            rolesDb.delete(`/${roleId}`);

            logger.debug(`Deleted role: ${roleId}`);
        } catch (error) {
            logger.warn("There was an error deleting a role.", error);
        }
    }

    triggerUiRefresh(): void {
        frontendCommunicator.send("custom-roles-updated");
    }
}

const customRolesManager = new CustomRolesManager();

export = customRolesManager;