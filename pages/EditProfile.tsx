import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, Check, Loader2, Save, User as UserIcon } from 'lucide-react';
import { useAuth } from '../authContext';
import { IMAGES } from '../constants';
import { useToast } from '../components/Toast';
import { buildAvatarDataUrl, validateAvatarSourceFile } from '../utils/avatarUpload';

interface EditProfilePageProps {
  onBack: () => void;
}

type Gender = 'male' | 'female';

const PRESET_AVATARS = [
  IMAGES.AVATAR_MALE,
  IMAGES.AVATAR_FEMALE,
  'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop',
];

export const EditProfilePage: React.FC<EditProfilePageProps> = ({ onBack }) => {
  const { currentUser, updateProfile } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [initialName, setInitialName] = useState('');
  const [initialAvatar, setInitialAvatar] = useState('');
  const [initialGender, setInitialGender] = useState<Gender>('male');
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const nextName = (currentUser.name || currentUser.email.split('@')[0] || '').trim();
    const nextAvatar = currentUser.avatar || '';
    const nextGender: Gender = currentUser.gender === 'female' ? 'female' : 'male';
    setName(nextName);
    setAvatar(nextAvatar);
    setGender(nextGender);
    setInitialName(nextName);
    setInitialAvatar(nextAvatar);
    setInitialGender(nextGender);
  }, [currentUser]);

  const fallbackAvatar = gender === 'female' ? IMAGES.AVATAR_FEMALE : IMAGES.AVATAR_MALE;
  const avatarPreview = avatar || fallbackAvatar;

  const hasChanges = useMemo(() => {
    const safeName = name.trim();
    return safeName !== initialName || avatar !== initialAvatar || gender !== initialGender;
  }, [name, avatar, gender, initialName, initialAvatar, initialGender]);

  const handleSave = async () => {
    if (!currentUser || isSaving || isProcessingAvatar) return;
    const safeName = (name.trim() || currentUser.email.split('@')[0] || '').slice(0, 64);

    const updates: {
      name?: string;
      avatar?: string;
      gender?: Gender;
    } = {};

    if (safeName !== initialName) updates.name = safeName;
    if (avatar !== initialAvatar) updates.avatar = avatar;
    if (gender !== initialGender) updates.gender = gender;

    if (Object.keys(updates).length === 0) {
      showToast('资料未修改', 'love');
      onBack();
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile(updates);
      showToast('资料已保存', 'success');
      onBack();
    } catch (error: any) {
      showToast(error?.message || '保存失败，请稍后重试', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const validateError = validateAvatarSourceFile(file);
    if (validateError) {
      showToast(validateError, 'error');
      return;
    }

    setIsProcessingAvatar(true);
    try {
      const compressedAvatar = await buildAvatarDataUrl(file);
      setAvatar(compressedAvatar);
      showToast('头像已处理，点击保存即可生效', 'success');
    } catch (error: any) {
      showToast(error?.message || '头像处理失败，请换一张图片再试', 'error');
    } finally {
      setIsProcessingAvatar(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--eye-bg-primary)] px-4 pt-safe-top animate-fade-in-up">
      <div className="flex items-center gap-4 py-4 mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-[var(--eye-bg-secondary)] transition-colors text-[var(--eye-text-primary)]"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-[var(--eye-text-primary)] flex-1 text-center pr-10">编辑资料</h1>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar pb-20">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-6 group cursor-pointer">
            <div
              className="w-32 h-32 rounded-full border-4 border-[var(--eye-bg-secondary)] shadow-lg bg-gray-200 bg-cover bg-center"
              style={{ backgroundImage: `url('${avatarPreview}')` }}
            />
            {isProcessingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/35 text-white flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
            <label className="absolute bottom-0 right-0 p-2.5 bg-primary text-white rounded-full shadow-lg cursor-pointer hover:bg-[#7a8a4b] active:scale-95 transition-all">
              <Camera className="w-5 h-5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          <p className="text-xs text-[var(--eye-text-secondary)] mb-2">
            自定义上传会自动压缩，保存后将同步到云端
          </p>

          <div className="relative w-full">
            <div className="flex gap-3 overflow-x-auto w-full px-2 py-2 hide-scrollbar">
              {PRESET_AVATARS.map((src, index) => (
                <button
                  key={index}
                  onClick={() => setAvatar(src)}
                  className={`flex-shrink-0 w-12 h-12 rounded-full bg-cover bg-center border-2 transition-all ${
                    avatar === src
                      ? 'border-primary ring-2 ring-primary/30 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundImage: `url('${src}')` }}
                />
              ))}
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[var(--eye-bg-primary)] to-transparent pointer-events-none" />
          </div>
        </div>

        <div className="space-y-6 px-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">昵称</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3.5 w-5 h-5 text-[var(--eye-text-secondary)]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的昵称"
                maxLength={64}
                className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 pl-10 text-[var(--eye-text-primary)] transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">性别（影响默认头像）</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setGender('male')}
                className={`h-12 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                  gender === 'male'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-[var(--eye-border)] bg-[var(--eye-bg-secondary)] text-[var(--eye-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>男生</span>
                {gender === 'male' && <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setGender('female')}
                className={`h-12 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                  gender === 'female'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-[var(--eye-border)] bg-[var(--eye-bg-secondary)] text-[var(--eye-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>女生</span>
                {gender === 'female' && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving || isProcessingAvatar || !hasChanges}
          className="w-full h-12 rounded-xl bg-primary text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-all hover:bg-[#7a8a4b] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            '保存中...'
          ) : isProcessingAvatar ? (
            '头像处理中...'
          ) : (
            <>
              <Save className="w-5 h-5" />
              保存资料
            </>
          )}
        </button>
      </div>
    </div>
  );
};

