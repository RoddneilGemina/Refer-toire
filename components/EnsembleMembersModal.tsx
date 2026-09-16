import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { EnsembleMember, UserRole } from '@/types/repertoire';
import { useRepertoire } from '@/context/RepertoireContext';

interface EnsembleMembersModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EnsembleMembersModal({
  visible,
  onClose,
}: EnsembleMembersModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const {
    currentInstance,
    currentUser,
    userRole,
    ensembleMembers,
    loadEnsembleMembers,
    promoteMember,
    demoteMember,
  } = useRepertoire();

  const [loading, setLoading] = useState<boolean>(false);
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);
  const [demotingUserId, setDemotingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && currentInstance) {
      setLoading(true);
      loadEnsembleMembers().finally(() => setLoading(false));
    }
  }, [visible, currentInstance, loadEnsembleMembers]);

  const admins = ensembleMembers.filter(m => m.role === 'admin');
  const members = ensembleMembers.filter(m => m.role !== 'admin');

  const handlePromote = async (member: EnsembleMember) => {
    const doPromote = async () => {
      setPromotingUserId(member.userId);
      const res = await promoteMember(member.userId);
      setPromotingUserId(null);

      if (res.success) {
        if (Platform.OS === 'web') {
          window.alert(`${member.fullName} has been promoted to Admin.`);
        } else {
          Alert.alert('Promoted to Admin', `${member.fullName} now has director and upload permissions.`);
        }
      } else {
        const msg = res.error || 'Failed to promote member.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Promotion Error', msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Promote ${member.fullName} to Admin?\n\nThey will be able to upload sheet music, edit the repertoire catalog, and manage ensemble members.`
      );
      if (confirmed) {
        await doPromote();
      }
    } else {
      Alert.alert(
        'Promote to Admin',
        `Are you sure you want to promote ${member.fullName} to Admin? They will have full director permissions to upload and edit repertoire.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Promote', style: 'default', onPress: doPromote },
        ]
      );
    }
  };

  const handleDemote = async (member: EnsembleMember) => {
    const doDemote = async () => {
      setDemotingUserId(member.userId);
      const res = await demoteMember(member.userId);
      setDemotingUserId(null);

      if (res.success) {
        if (Platform.OS === 'web') {
          window.alert(`${member.fullName} has been changed to a regular Member.`);
        } else {
          Alert.alert('Role Changed', `${member.fullName} is now a Member.`);
        }
      } else {
        const msg = res.error || 'Failed to change role.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Error', msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Make ${member.fullName} a regular Member?\n\nThey will no longer be able to upload or edit sheet music.`
      );
      if (confirmed) {
        await doDemote();
      }
    } else {
      Alert.alert(
        'Make Member',
        `Are you sure you want to demote ${member.fullName} to Member? They will no longer have admin privileges.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Make Member', style: 'destructive', onPress: doDemote },
        ]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          {/* Modal Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              <View style={[styles.titleRow, { backgroundColor: 'transparent' }]}>
                <Ionicons name="people" size={22} color={theme.tint} style={{ marginRight: 8 }} />
                <Text style={[styles.headerTitle, { color: theme.text }]}>Ensemble Roster</Text>
              </View>
              <Text style={[styles.headerSub, { color: theme.subtext }]}>
                {currentInstance?.name} • Code:{' '}
                <Text style={{ color: theme.tint, fontWeight: '700' }}>{currentInstance?.code}</Text>{' '}
                • {ensembleMembers.length} {ensembleMembers.length === 1 ? 'Singer' : 'Singers'}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.subtext} />
            </TouchableOpacity>
          </View>

          {/* Members List Scroll */}
          {loading && ensembleMembers.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.tint} />
              <Text style={[styles.loadingText, { color: theme.subtext }]}>Loading ensemble singers...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollBody}>
              {/* SECTION 1: ADMINS & DIRECTORS (AT TOP) */}
              <View style={[styles.sectionContainer, { backgroundColor: 'transparent' }]}>
                <View style={[styles.sectionHeaderRow, { backgroundColor: 'transparent' }]}>
                  <View style={[styles.adminHeaderBadge, { backgroundColor: '#F59E0B22' }]}>
                    <Ionicons name="star" size={14} color="#D97706" style={{ marginRight: 4 }} />
                    <Text style={[styles.sectionTitle, { color: '#B45309' }]}>
                      DIRECTORS & ADMINS ({admins.length})
                    </Text>
                  </View>
                </View>

                {admins.length === 0 ? (
                  <Text style={[styles.emptySectionText, { color: theme.subtext }]}>
                    No administrators listed.
                  </Text>
                ) : (
                  admins.map(admin => {
                    const isYou = currentUser?.id === admin.userId;
                    const isOwner = admin.isOwner || (currentInstance?.creatorId && admin.userId === currentInstance.creatorId);
                    const isDemoting = demotingUserId === admin.userId;
                    return (
                      <View
                        key={admin.id || admin.userId}
                        style={[
                          styles.memberCard,
                          {
                            backgroundColor: theme.surfaceSubtle,
                            borderColor: isYou ? theme.tint : theme.border,
                            borderWidth: isYou ? 1.5 : 1,
                          },
                        ]}>
                        <View style={[styles.avatarCircle, { backgroundColor: isOwner ? '#FDE68A' : '#E0E7FF' }]}>
                          <Ionicons name={isOwner ? 'ribbon' : 'shield-checkmark'} size={20} color={isOwner ? '#B45309' : '#4338CA'} />
                        </View>

                        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                          <View style={[styles.nameRow, { backgroundColor: 'transparent' }]}>
                            <Text style={[styles.memberName, { color: theme.text }]}>
                              {admin.fullName}
                            </Text>
                            {isYou && (
                              <View style={[styles.youBadge, { backgroundColor: theme.badgeBackground }]}>
                                <Text style={[styles.youBadgeText, { color: theme.badgeText }]}>You</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.memberEmail, { color: theme.subtext }]}>
                            {admin.email}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 4, backgroundColor: 'transparent' }}>
                          <View style={[styles.roleBadgeAdmin, { backgroundColor: isOwner ? '#FEF3C7' : '#EEF2FF' }]}>
                            <Text style={[styles.roleBadgeAdminText, { color: isOwner ? '#92400E' : '#3730A3' }]}>
                              {isOwner ? '👑 Owner & Director' : '👑 Admin'}
                            </Text>
                          </View>
                          {admin.voicePart && (
                            <View style={[styles.voicePill, { backgroundColor: theme.card }]}>
                              <Text style={[styles.voicePillText, { color: theme.subtext }]}>
                                {admin.voicePart}
                              </Text>
                            </View>
                          )}

                          {/* Demote Button: Visible to admins for other admins who are not the owner */}
                          {userRole === 'admin' && !isYou && !isOwner && (
                            <TouchableOpacity
                              style={[styles.demoteBtn, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
                              onPress={() => handleDemote(admin)}
                              disabled={isDemoting}>
                              {isDemoting ? (
                                <ActivityIndicator size="small" color="#DC2626" />
                              ) : (
                                <>
                                  <Ionicons name="arrow-down-circle-outline" size={13} color="#DC2626" style={{ marginRight: 3 }} />
                                  <Text style={styles.demoteBtnText}>Make Member</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* SECTION 2: ENSEMBLE SINGERS & MEMBERS */}
              <View style={[styles.sectionContainer, { marginTop: 18, backgroundColor: 'transparent' }]}>
                <View style={[styles.sectionHeaderRow, { backgroundColor: 'transparent' }]}>
                  <View style={[styles.memberHeaderBadge, { backgroundColor: theme.surfaceSubtle }]}>
                    <Ionicons name="people" size={14} color={theme.subtext} style={{ marginRight: 4 }} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      SINGERS & MEMBERS ({members.length})
                    </Text>
                  </View>
                </View>

                {members.length === 0 ? (
                  <View
                    style={[
                      styles.noMembersBox,
                      { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                    ]}>
                    <Ionicons name="person-add-outline" size={28} color={theme.subtext} style={{ marginBottom: 6 }} />
                    <Text style={[styles.noMembersTitle, { color: theme.text }]}>No Other Singers Yet</Text>
                    <Text style={[styles.noMembersSub, { color: theme.subtext }]}>
                      Share code <Text style={{ color: theme.tint, fontWeight: '700' }}>{currentInstance?.code}</Text>{' '}
                      with your choir. When singers sign up, they will automatically appear here!
                    </Text>
                  </View>
                ) : (
                  members.map(member => {
                    const isYou = currentUser?.id === member.userId;
                    const isPromoting = promotingUserId === member.userId;
                    return (
                      <View
                        key={member.id || member.userId}
                        style={[
                          styles.memberCard,
                          {
                            backgroundColor: theme.surfaceSubtle,
                            borderColor: isYou ? theme.tint : theme.border,
                            borderWidth: isYou ? 1.5 : 1,
                          },
                        ]}>
                        <View style={[styles.avatarCircle, { backgroundColor: theme.badgeBackground }]}>
                          <Ionicons name="person" size={18} color={theme.tint} />
                        </View>

                        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                          <View style={[styles.nameRow, { backgroundColor: 'transparent' }]}>
                            <Text style={[styles.memberName, { color: theme.text }]}>
                              {member.fullName}
                            </Text>
                            {isYou && (
                              <View style={[styles.youBadge, { backgroundColor: theme.badgeBackground }]}>
                                <Text style={[styles.youBadgeText, { color: theme.badgeText }]}>You</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.memberEmail, { color: theme.subtext }]}>
                            {member.email}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 6, backgroundColor: 'transparent' }}>
                          {member.voicePart && (
                            <View style={[styles.voicePill, { backgroundColor: theme.card }]}>
                              <Text style={[styles.voicePillText, { color: theme.subtext }]}>
                                {member.voicePart}
                              </Text>
                            </View>
                          )}

                          {/* Promote Button (Visible only to Admins) */}
                          {userRole === 'admin' && !isYou && (
                            <TouchableOpacity
                              style={[styles.promoteBtn, { backgroundColor: '#F59E0B22', borderColor: '#D97706' }]}
                              onPress={() => handlePromote(member)}
                              disabled={isPromoting}>
                              {isPromoting ? (
                                <ActivityIndicator size="small" color="#D97706" />
                              ) : (
                                <>
                                  <Ionicons name="arrow-up-circle-outline" size={14} color="#D97706" style={{ marginRight: 4 }} />
                                  <Text style={styles.promoteBtnText}>Promote</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          )}

          {/* Modal Footer */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: theme.tint }]}
              onPress={onClose}>
              <Text style={styles.doneBtnText}>Close Roster</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
  },
  scrollBody: {
    padding: 18,
  },
  sectionContainer: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  adminHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  memberHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptySectionText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
  },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  memberEmail: {
    fontSize: 11,
    marginTop: 2,
  },
  roleBadgeAdmin: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeAdminText: {
    fontSize: 10,
    fontWeight: '700',
  },
  voicePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150, 150, 150, 0.2)',
  },
  voicePillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  promoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  promoteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  demoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  demoteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  noMembersBox: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMembersTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  noMembersSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 360,
  },
  footer: {
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
