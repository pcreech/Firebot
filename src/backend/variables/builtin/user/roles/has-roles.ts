import { ReplaceVariable } from "../../../../../types/variables";
import { OutputDataType, VariableCategory } from "../../../../../shared/variable-constants";
import { EffectTrigger } from "../../../../../shared/effect-constants";

import twitchApi from "../../../../twitch-api/api";
import roleHelpers from "../../../../roles/role-helpers";

const triggers = {};
triggers[EffectTrigger.COMMAND] = true;
triggers[EffectTrigger.EVENT] = true;
triggers[EffectTrigger.MANUAL] = true;
triggers[EffectTrigger.CUSTOM_SCRIPT] = true;
triggers[EffectTrigger.PRESET_LIST] = true;
triggers[EffectTrigger.CHANNEL_REWARD] = true;

const model : ReplaceVariable = {
    definition: {
        handle: "hasRoles",
        usage: "hasRoles[user, any|all, role, role2, ...]",
        description: "Returns true if the user has the specified roles. Only valid within $if",
        examples: [
            {
                usage: "hasRoles[$user, any, mod, vip]",
                description: "returns true if $user is a mod OR VIP"
            },
            {
                usage: "hasRoles[$user, all, mod, vip]",
                description: "Returns true if $user is a mod AND a VIP"
            }
        ],
        triggers: triggers,
        categories: [VariableCategory.COMMON, VariableCategory.USER],
        possibleDataOutput: [OutputDataType.ALL]
    },
    evaluator: async (trigger, username: string, respective, ...roles) => {
        if (username == null || username === "") {
            return false;
        }

        if (respective == null || respective === "") {
            return false;
        }

        if (roles == null || roles.length === 0) {
            return false;
        }

        respective = (`${respective}`).toLowerCase();
        if (respective !== "any" && respective !== "all") {
            return false;
        }

        const user = await twitchApi.users.getUserByName(username);
        if (user == null) {
            return false;
        }

        const userRoles = await roleHelpers.getAllRolesForViewer(user.id);

        // any
        if (respective === "any") {
            return userRoles.some(r => roles.includes(r.name));
        }

        // all
        return roles.length === userRoles.filter(r => roles.includes(r.name)).length;
    }
};

export default model;